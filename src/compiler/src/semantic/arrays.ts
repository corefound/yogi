import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function ArraysSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitArrayLikeDeclarations(node: any): any {
            switch (node.kind) {
                case Kinds.Statements.ArrayDeclaration:
                    return this.visitArrayDeclarations(node);

                default:
                    return this.visitNode(node);
            }
        }

        public visitArrayDeclarations(node: any) {
            const value = Array.isArray(node.value)
                ? node.value.map((item: any) => this.visitNode(item))
                : null;

            const context = { ...node, value };

            const { trusted } = this.declarationArrayDiagnostics(context);

            const linkageName = node.export
                ? this.getLinkageName(this.modulePath.relativePath, node.name)
                : null;

            const qualifiedName = this.getQualifiedName(
                this.modulePath.relativePath,
                node.name,
            );

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Variable,
                name: node.name,
                linkageName,
                qualifiedName,
                type: node.type,
                declaredType: node.type,
                mutable: node.flag.name !== "const",
                storage: Kinds.Storage.stack,
                escapes: false,
                trusted,
                node: value,
            });

            delete node.value;

            return {
                kind: Kinds.Statements.ArrayDeclaration,

                symbolId: symbol.id,
                scopeId: symbol.scopeId,
                mutable: symbol.mutable,
                storage: symbol.storage,
                escapes: symbol.escapes,
                length: value.length,

                linkageName,
                qualifiedName,

                flag: node.flag,
                export: node.export,
                type: node.type,

                trusted,
                elements: value,
                ...node,
            };
        }

        public declarationArrayDiagnostics(context: any): any {
            let trusted = true;

            if (!context.value) {
                const message =
                    `${Helpers.RED}'${context.name}'${Helpers.RESET} must be initialized.`;

                this.throwError(
                    message,
                    context.position,
                    context.fullSource,
                    context,
                );
            }

            if (context.type.kind === Kinds.Types.UnTyped) {
                this.throwError(
                    Kinds.ErrrorsMessage.MissingType,
                    context.position,
                    context.fullSource,
                    context,
                );
            }

            if (context.flag.name !== "const" && context.flag.name !== "let") {
                const message =
                    `${Helpers.RED}'${context.flag.name}'${Helpers.RESET} declarations are not allowed`;

                context.arrowLength = context.flag.name.length;

                this.throwError(
                    message,
                    context.flag.position,
                    context.fullSource,
                    context,
                    "  = use 'let' for mutable bindings\n  = use 'const' for immutable bindings",
                );
            }

            const scopeSymbol = this.resolveLocalSymbol(context.name);

            if (scopeSymbol) {
                const message =
                    `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} is defined multiple times`;

                context.arrowLength = context.name.length;

                this.throwError(
                    message,
                    context.position,
                    context.fullSource,
                    context,
                );
            }

            if (context.type.kind !== Kinds.Types.ArrayType) {
                const message =
                    `name ${Helpers.BLUE}'${context.name}'${Helpers.RESET} must be declared with an array type`;

                context.arrowLength = context.name.length + 1;

                this.throwError(
                    message,
                    context.position,
                    context.fullSource,
                    context,
                );
            }

            if (!Array.isArray(context.value)) {
                const message =
                    `name ${Helpers.BLUE}'${context.name}'${Helpers.RESET} must be initialized with an array value`;

                context.arrowLength = context.name.length + 1;

                this.throwError(
                    message,
                    context.position,
                    context.fullSource,
                    context,
                );
            }

            for (const element of context.value) {
                if (!this.checkArrayElementType(context.type.elementType, element)) {
                    const message =
                        `array ${Helpers.BLUE}'${context.name}'${Helpers.RESET} can only contain values of type ${Helpers.BLUE}'${context.type.elementType.raw}'${Helpers.RESET}`;

                    element.arrowLength = element.source?.length ?? 1;

                    this.throwError(
                        message,
                        element.position ?? context.position,
                        context.fullSource,
                        element,
                    );
                }
            }

            return { trusted };
        }

        public checkArrayElementType(expectedType: any, value: any): boolean {
            if (!value?.type) return false;

            return this.isTypeAssignable(expectedType, value.type);
        }

        public visitArrayExpression(node: any): any {
            const elements = (node.elements ?? []).map((element: any) => this.visitNode(element));

            return {
                ...node,
                kind: Kinds.Collections.ArrayExpression,
                elements,
                type: {
                    kind: Kinds.Types.TupleType,
                    raw: `[${elements.map((element: any) => element.type?.raw ?? "unknown").join(", ")}]`,
                    elements: elements.map((element: any) => element.type),
                },
            };
        }

        public visitDictionaryExpression(node: any): any {
            const properties = (node.properties ?? []).map((property: any) => {
                const value = this.visitNode(property.value);

                return {
                    ...property,
                    value,
                    type: value?.type,
                    name: property.key,
                    optional: false,
                    readonly: false,
                };
            });

            return {
                ...node,
                kind: Kinds.Collections.DictionaryExpression,
                properties,
                type: {
                    kind: Kinds.Types.TypeLiteral,
                    raw: node.source ?? "{ }",
                    members: properties.map((property: any) => ({
                        kind: Kinds.Types.PropertySignature,
                        name: property.key,
                        type: property.type,
                        optional: false,
                        readonly: false,
                        raw: property.source,
                        position: property.position,
                    })),
                },
            };
        }
    };
}
