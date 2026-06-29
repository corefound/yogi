import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function VariablesSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitVariableLikeDeclarations(node: any): any {
            switch (node.kind) {
                case Kinds.Statements.VariableDeclaration:
                    return this.visitVariableDeclarations(node);

                default:
                    return this.visitNode(node);
            }
        }

        public visitVariableDeclarations(node: any) {
            const value = node.value ? this.visitNode(node.value) : null;
            const context = { ...node, value };
            const { trusted } = this.declarationVariableDiagnostics(context);
            const type = this.toSerializableType(node.type);
            const runtimeValue = this.createRuntimeInitializerValue(value, type);

            const linkageName = node.export
                ? this.getLinkageName(this.modulePath.relativePath, node.name)
                : null;

            const qualifiedName = this.getQualifiedName(
                this.modulePath.relativePath,
                node.name,
            );

            const flagName = this.getDeclarationFlagName(node.flag);

            const isAmbient =
                node.declare === true ||
                node.ambient === true;
            const lifetime = this.getVariableLifetime(node, type, isAmbient);

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Variable,
                name: node.name,
                linkageName,
                qualifiedName,
                type,
                declaredType: type,

                mutable: flagName !== "const",
                storage: lifetime.storage,

                escapes: lifetime.escapes,
                trusted,

                declare: isAmbient,
                ambient: isAmbient,
                emit: !isAmbient,

                node: value,
            });

            this.setAggregateOwner(
                symbol,
                this.getAggregateSymbolFromExpression(value),
            );

            if (node.export) {
                this.exportSymbol(symbol);
            }

            return {
                ...node,

                kind: Kinds.Statements.VariableDeclaration,

                symbolId: symbol.id,
                scopeId: symbol.scopeId,

                mutable: symbol.mutable,
                storage: lifetime.storage,
                escapes: lifetime.escapes,

                linkageName,
                qualifiedName,

                flag: flagName,
                export: node.export ?? false,

                declare: isAmbient,
                ambient: isAmbient,
                emit: !isAmbient,

                type,

                trusted,
                value: runtimeValue,
            };
        }

        public getDeclarationFlagName(flag: any): string {
            if (!flag) return "";

            if (typeof flag === "string") {
                return flag;
            }

            if (typeof flag.name === "string") {
                return flag.name;
            }

            if (typeof flag.raw === "string") {
                return flag.raw;
            }

            return String(flag);
        }

        public getVariableLifetime(node: any, type: any, isAmbient: boolean): { storage: Kinds.Storage | null; escapes: boolean } {
            if (isAmbient) {
                return { storage: null, escapes: false };
            }

            if (node.export === true || this.currentScope.parent === null) {
                return { storage: Kinds.Storage.global, escapes: true };
            }

            if (this.isAggregateType(type)) {
                return { storage: Kinds.Storage.stack, escapes: false };
            }

            return { storage: Kinds.Storage.stack, escapes: false };
        }

        public declarationVariableDiagnostics(context: any): any {
            let trusted = true;
            let value = context.value;

            const isAmbient =
                context.declare === true ||
                context.ambient === true;

            const source =
                context.fullSource ??
                context.source ??
                context.raw;

            const flagName = this.getDeclarationFlagName(context.flag);

            if (flagName !== "const" && flagName !== "let") {
                const message =
                    `${Helpers.RED}'${flagName}'${Helpers.RESET} declarations are not allowed`;
                const flagContext = {
                    ...context,
                    position: context.flag?.position ?? context.position,
                    arrowLength: flagName.length || 1,
                };

                this.throwError(
                    message,
                    flagContext.position,
                    source,
                    flagContext,
                    "  = use 'let' for mutable bindings\n  = use 'const' for immutable bindings",
                );
            }

            if (isAmbient && context.value) {
                const message =
                    `${Helpers.RED}'declare'${Helpers.RESET} declarations cannot have an initializer`;

                context.arrowLength = context.name?.length ?? 1;

                this.throwError(
                    message,
                    context.position,
                    source,
                    context,
                );
            }

            if (context.definiteAssignment === true) {
                const message =
                    `${Helpers.RED}'${context.name}'${Helpers.RESET} cannot use a definite assignment assertion`;

                context.arrowLength = context.name?.length ?? 1;

                this.throwError(
                    message,
                    context.position,
                    source,
                    context,
                    "  = variables in this language must be initialized immediately",
                );
            }

            if (!context.value && !isAmbient) {
                const message =
                    `${Helpers.RED}'${context.name}'${Helpers.RESET} must be initialized.`;

                context.arrowLength = context.name?.length ?? 1;

                this.throwError(
                    message,
                    context.position,
                    source,
                    context,
                );
            }

            if (context.value?.kind === Kinds.Expressions.BinaryExpression) {
                value = this.visitBinaryExpression(context);
            }

            if (!context.type || context.type.kind === Kinds.Types.UnTyped) {
                this.throwError(
                    Kinds.ErrrorsMessage.MissingType,
                    context.position,
                    source,
                    context,
                );
            }

            this.validateTypeUsages(context.type, source);

            const scopeSymbol = this.resolveLocalSymbol(context.name);

            if (scopeSymbol) {
                const message =
                    `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} is defined multiple times`;

                context.arrowLength = context.name?.length ?? 1;

                this.throwError(
                    message,
                    context.position,
                    source,
                    context,
                );
            }

            if (!isAmbient) {
                this.validateAggregateAssignment(context.type, value, context, source);
            }

            if (!isAmbient) {
                this.validateCustomIntegerLayoutInitializer(context.type, value, context, source);
            }

            if (!isAmbient && this.rejectsImplicitObjectContractConversion(context.type, value)) {
                this.throwImplicitObjectContractConversionError(context.type, value, source, context);
            }

            if (!isAmbient && !this.checkDataType(context.type, value)) {
                const actualType = value?.type;
                const message = actualType?.kind === Kinds.Types.AnyType
                    ? `cannot initialize ${Helpers.BLUE}'${context.name}'${Helpers.RESET} of type ` +
                    `${Helpers.BLUE}'${context.type.raw}'${Helpers.RESET} from ${Helpers.RED}'any'${Helpers.RESET} without an explicit cast`
                    : `name ${Helpers.BLUE}'${context.name}'${Helpers.RESET} can only initialize values of type ` +
                    `${Helpers.BLUE}'${context.type.raw}'${Helpers.RESET}`;

                value.arrowLength = value.source?.length ?? context.name?.length ?? 1;

                this.throwError(
                    message,
                    value.position ?? context.position,
                    source,
                    value,
                    actualType?.kind === Kinds.Types.AnyType
                        ? `  = write '${value.source ?? context.name} as ${context.type.raw}' when the cast is intentional`
                        : undefined,
                );
            }

            return { trusted };
        }
        public checkDataType(expectedType: any, value: any): boolean {
            if (!value?.type) return false;

            return this.isTypeAssignable(expectedType, value.type);
        }

        public validateCustomIntegerLayoutInitializer(expectedType: any, value: any, context: any, source: string): void {
            const layout = this.getCustomIntegerLayout(expectedType);
            if (!layout || !value) return;

            const typeName = expectedType?.raw ?? this.getTypeReferenceName(expectedType) ?? "custom integer";
            const valueIsNumber = this.resolveType(value.type)?.kind === Kinds.Types.NumberType;

            if (value.kind !== Kinds.Sir.NumberConstant) {
                if (valueIsNumber) {
                    value.arrowLength = value.source?.length ?? context.name?.length ?? 1;
                    this.throwError(
                        `cannot initialize ${Helpers.BLUE}'${context.name}'${Helpers.RESET} of type ` +
                        `${Helpers.BLUE}'${typeName}'${Helpers.RESET} from ${Helpers.RED}'number'${Helpers.RESET} without an explicit conversion`,
                        value.position ?? context.position,
                        source,
                        value,
                        "  = custom integer layouts require a known integer literal for now\n  = arbitrary number values may be out of range or fractional",
                    );
                }

                return;
            }

            if (!Number.isInteger(value.value)) {
                value.arrowLength = value.source?.length ?? value.raw?.length ?? 1;
                this.throwError(
                    `literal ${Helpers.RED}'${value.source ?? value.raw ?? value.value}'${Helpers.RESET} cannot initialize ` +
                    `${Helpers.BLUE}'${typeName}'${Helpers.RESET} because integer layouts cannot store fractional values`,
                    value.position ?? context.position,
                    source,
                    value,
                );
            }

            const rawLiteral = String(value.source ?? value.raw ?? value.value).replace(/_/g, "");
            const literal = BigInt(rawLiteral);
            const bits = BigInt(layout.bits);
            const signed = layout.signed !== false;
            const min = signed ? -(1n << (bits - 1n)) : 0n;
            const max = signed ? (1n << (bits - 1n)) - 1n : (1n << bits) - 1n;

            if (literal < min || literal > max) {
                value.arrowLength = value.source?.length ?? value.raw?.length ?? 1;
                this.throwError(
                    `literal ${Helpers.RED}'${value.source ?? value.raw ?? value.value}'${Helpers.RESET} does not fit ` +
                    `${Helpers.BLUE}'${typeName}'${Helpers.RESET} integer layout ` +
                    `(${signed ? "signed" : "unsigned"} ${layout.bits}-bit range ${min.toString()}..${max.toString()})`,
                    value.position ?? context.position,
                    source,
                    value,
                );
            }
        }

        public getCustomIntegerLayout(type: any): { bits: number; signed?: boolean; align?: number } | null {
            const resolved = this.resolveType(type);

            if (
                resolved?.kind !== Kinds.Types.StructDeclaration &&
                resolved?.kind !== "StructDeclaration"
            ) {
                return null;
            }

            if (resolved.isScalar !== true || !resolved.layout?.bits) {
                return null;
            }

            const scalarBase = this.scalarStructBaseType(type);
            if (this.resolveType(scalarBase)?.kind !== Kinds.Types.NumberType) {
                return null;
            }

            return resolved.layout;
        }

        public createRuntimeInitializerValue(value: any, expectedType: any): any {
            if (!value) return value;

            if (value.kind === Kinds.Collections.ArrayExpression) {
                return {
                    ...value,
                    type: this.toSerializableType(expectedType),
                };
            }

            if (value.kind === Kinds.Collections.DictionaryExpression) {
                return {
                    ...value,
                    type: this.toSerializableType(expectedType),
                    properties: (value.properties ?? []).map((property: any) => ({
                        ...property,
                        type: this.toSerializableType(property.type),
                    })),
                };
            }

            return value;
        }
    };
}
