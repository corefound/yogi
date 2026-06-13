import path from "node:path";
import { BaseSemantic, Constructor } from "./base";
import { Helpers } from "../helpers";
import { Kinds } from "../helpers/types";
import { LinkKind } from "../fbs";

const SUPPORTED_EXTERN_EXTENSIONS = new Set([".a", ".dylib", ".o", ".asm"]);

export function ExternsSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitExterns(node: any): any {
            if (node.kind !== Kinds.Externs.ExternDeclarations) {
                return null;
            }

            return this.visitExternDeclaration(node);
        }

        public visitExternDeclaration(node: any): any {
            const name = this.getExternNameText(node.name);
            const source = node.source ?? node.raw ?? this.createExternSource(node);
            const externPath = this.getExternPathText(node.path);
            const members = node.members ?? [];

            this.externDeclarationDiagnostics(node, name, externPath, members, source);
            this.registerExternalLink({
                kind: this.getExternLinkKind(externPath),
                path: externPath,
            });

            const functions = members
                .filter((member: any) => member.kind === Kinds.Types.MethodSignature)
                .map((member: any) => this.visitExternFunction(member, source));

            const variables = members
                .filter((member: any) => member.kind === Kinds.Types.PropertySignature)
                .map((member: any) => this.visitExternVariable(member, source));

            const qualifiedName = this.getQualifiedName(this.modulePath.relativePath, name);

            const semanticNode = {
                kind: Kinds.Sir.ExternDeclaration,
                name,
                path: externPath,
                functions,
                variables,
                source,
                position: node.position,
                qualifiedName,
                trusted: true,
            };

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Extern,
                name,
                linkageName: null,
                qualifiedName,
                type: semanticNode,
                mutable: false,
                storage: null,
                escapes: false,
                trusted: true,
                node: semanticNode,
            });

            return {
                ...semanticNode,
                symbolId: symbol.id,
                scopeId: symbol.scopeId,
            };
        }

        public visitExternVariable(member: any, declarationSource: string): any {
            const name = this.getExternNameText(member.name);
            const type = this.normalizeExternType(member.type);

            this.externVariableDiagnostics(member, name, type, declarationSource);

            return {
                kind: Kinds.Sir.ExternVariable,
                name,
                type,
                readonly: Boolean(member.readonly),
                source: member.raw ?? member.source ?? "",
                position: member.position,
            };
        }

        public visitExternFunction(member: any, declarationSource: string): any {
            const name = this.getExternNameText(member.name);
            const parameters = member.parameters ?? [];
            const returnType = this.normalizeExternType(member.returnType);

            this.externFunctionDiagnostics(member, name, parameters, returnType, declarationSource);

            return {
                kind: Kinds.Sir.ExternFunction,
                name,
                parameters: parameters.map((parameter: any) => {
                    return this.visitExternParameter(parameter, member.raw ?? member.source ?? declarationSource);
                }),
                returnType,
                optional: Boolean(member.optional),
                source: member.raw ?? member.source ?? "",
                position: member.position,
            };
        }

        public visitExternParameter(parameter: any, functionSource: string): any {
            const name = this.getExternNameText(parameter.name);
            const type = this.normalizeExternType(parameter.type);

            this.externParameterDiagnostics(parameter, name, type, functionSource);

            return {
                kind: Kinds.Sir.ExternParameter,
                name,
                type,
                optional: Boolean(parameter.optional),
                rest: Boolean(parameter.rest),
                position: parameter.position,
            };
        }

        public externDeclarationDiagnostics(
            node: any,
            name: string,
            path: string,
            members: any[],
            source: string,
        ): void {
            if (!name) {
                this.throwError("extern declaration is missing a name", node.position, source, node);
            }

            if (!path) {
                this.throwError(
                    `extern ${Helpers.RED}'${name}'${Helpers.RESET} is missing a source path`,
                    node.position,
                    source,
                    node,
                );
            }

            if (!this.isSupportedExternPath(path)) {
                node.arrowLength = node.pathRaw?.length ?? path.length ?? 1;
                this.throwError(
                    `extern ${Helpers.RED}'${name}'${Helpers.RESET} uses unsupported external file type ` +
                    `${Helpers.RED}'${this.getExternPathExtension(path) || "<none>"}'${Helpers.RESET}`,
                    node.pathPosition ?? node.position,
                    source,
                    node,
                    `  = supported extern file extensions: ${this.getSupportedExternExtensionsText()}`,
                );
            }

            if (this.resolveLocalSymbol(name)) {
                node.arrowLength = name.length;
                this.throwError(
                    `the name ${Helpers.RED}'${name}'${Helpers.RESET} is defined multiple times`,
                    node.position,
                    source,
                    node,
                );
            }

            if (!members.length) {
                node.arrowLength = name.length;
                this.throwError(
                    `extern ${Helpers.RED}'${name}'${Helpers.RESET} must declare at least one function or variable`,
                    node.position,
                    source,
                    node,
                );
            }

            const memberNames = new Set<string>();

            for (const member of members) {
                if (
                    member.kind !== Kinds.Types.MethodSignature &&
                    member.kind !== Kinds.Types.PropertySignature
                ) {
                    member.arrowLength = member.raw?.length ?? 1;
                    this.throwError(
                        `extern ${Helpers.RED}'${name}'${Helpers.RESET} can only contain function signatures or variable declarations`,
                        member.position ?? node.position,
                        source,
                        member,
                    );
                }

                const memberName = this.getExternNameText(member.name);
                if (memberNames.has(memberName)) {
                    member.arrowLength = memberName.length || 1;
                    this.throwError(
                        `extern member ${Helpers.RED}'${memberName}'${Helpers.RESET} is defined multiple times`,
                        member.position,
                        source,
                        member,
                    );
                }

                memberNames.add(memberName);
            }
        }

        public externVariableDiagnostics(
            member: any,
            name: string,
            type: any,
            declarationSource: string,
        ): void {
            const source = member.raw ?? member.source ?? declarationSource;

            if (!name) {
                this.throwError("extern variable is missing a name", member.position, source, member);
            }

            if (member.optional) {
                member.arrowLength = name.length || 1;
                this.throwError(
                    `extern variable ${Helpers.RED}'${name}'${Helpers.RESET} cannot be optional`,
                    member.position,
                    source,
                    member,
                );
            }

            if (!this.isSupportedExternVariableType(type)) {
                member.arrowLength = type?.raw?.length ?? name.length ?? 1;
                this.throwError(
                    `extern variable ${Helpers.RED}'${name}'${Helpers.RESET} has unsupported type ` +
                    `${Helpers.RED}'${type?.raw ?? "unknown"}'${Helpers.RESET}`,
                    type?.position ?? member.position,
                    source,
                    member,
                );
            }
        }

        public externFunctionDiagnostics(
            member: any,
            name: string,
            parameters: any[],
            returnType: any,
            declarationSource: string,
        ): void {
            const source = member.raw ?? member.source ?? declarationSource;

            if (!name) {
                this.throwError("extern function is missing a name", member.position, source, member);
            }

            if ((member.typeParameters ?? []).length > 0) {
                member.arrowLength = name.length || 1;
                this.throwError(
                    `extern function ${Helpers.RED}'${name}'${Helpers.RESET} cannot be generic`,
                    member.position,
                    source,
                    member,
                );
            }

            if (member.optional) {
                member.arrowLength = name.length || 1;
                this.throwError(
                    `extern function ${Helpers.RED}'${name}'${Helpers.RESET} cannot be optional`,
                    member.position,
                    source,
                    member,
                );
            }

            if (!this.isSupportedExternReturnType(returnType)) {
                member.arrowLength = member.returnType?.raw?.length ?? name.length ?? 1;
                this.throwError(
                    `extern function ${Helpers.RED}'${name}'${Helpers.RESET} has unsupported return type ` +
                    `${Helpers.RED}'${returnType?.raw ?? "unknown"}'${Helpers.RESET}`,
                    member.returnType?.position ?? member.position,
                    source,
                    member,
                );
            }

            const parameterNames = new Set<string>();
            for (const parameter of parameters) {
                const parameterName = this.getExternNameText(parameter.name);
                if (parameterNames.has(parameterName)) {
                    parameter.arrowLength = parameterName.length || 1;
                    this.throwError(
                        `parameter ${Helpers.RED}'${parameterName}'${Helpers.RESET} is defined multiple times`,
                        parameter.position,
                        source,
                        parameter,
                    );
                }

                parameterNames.add(parameterName);
            }
        }

        public externParameterDiagnostics(parameter: any, name: string, type: any, functionSource: string): void {
            if (!name) {
                this.throwError("extern parameter is missing a name", parameter.position, functionSource, parameter);
            }

            if (parameter.optional) {
                parameter.arrowLength = name.length || 1;
                this.throwError(
                    `extern parameter ${Helpers.RED}'${name}'${Helpers.RESET} cannot be optional`,
                    parameter.position,
                    functionSource,
                    parameter,
                );
            }

            if (parameter.rest) {
                parameter.arrowLength = name.length || 1;
                this.throwError(
                    `extern parameter ${Helpers.RED}'${name}'${Helpers.RESET} cannot be a rest parameter`,
                    parameter.position,
                    functionSource,
                    parameter,
                );
            }

            if (parameter.defaultValue) {
                parameter.arrowLength = name.length || 1;
                this.throwError(
                    `extern parameter ${Helpers.RED}'${name}'${Helpers.RESET} cannot have a default value`,
                    parameter.position,
                    functionSource,
                    parameter,
                );
            }

            if (!this.isSupportedExternParameterType(type)) {
                parameter.arrowLength = type?.raw?.length ?? name.length ?? 1;
                this.throwError(
                    `extern parameter ${Helpers.RED}'${name}'${Helpers.RESET} has unsupported type ` +
                    `${Helpers.RED}'${type?.raw ?? "unknown"}'${Helpers.RESET}`,
                    type?.position ?? parameter.position,
                    functionSource,
                    parameter,
                );
            }
        }

        public normalizeExternType(type: any): any {
            if (!type) {
                return {
                    kind: Kinds.Types.UnknownType,
                    raw: "unknown",
                };
            }

            return {
                kind: type.kind,
                raw: type.raw ?? "unknown",
                position: type.position,
            };
        }

        public isSupportedExternParameterType(type: any): boolean {
            return (
                type?.kind === Kinds.Types.StringType ||
                type?.kind === Kinds.Types.NumberType ||
                type?.kind === Kinds.Types.BooleanType
            );
        }

        public isSupportedExternReturnType(type: any): boolean {
            return (
                this.isSupportedExternParameterType(type) ||
                type?.kind === Kinds.Types.VoidType
            );
        }

        public isSupportedExternVariableType(type: any): boolean {
            return this.isSupportedExternParameterType(type);
        }

        public isSupportedExternPath(externPath: string): boolean {
            return SUPPORTED_EXTERN_EXTENSIONS.has(this.getExternPathExtension(externPath));
        }

        public getExternLinkKind(externPath: string): LinkKind {
            switch (this.getExternPathExtension(externPath)) {
                case ".a":
                    return LinkKind.static_library;

                case ".dylib":
                    return LinkKind.dynamic_library;

                case ".o":
                case ".asm":
                    return LinkKind.object;

                default:
                    return LinkKind.system_library;
            }
        }

        public getExternPathExtension(externPath: string): string {
            return path.extname(externPath).toLowerCase();
        }

        public getSupportedExternExtensionsText(): string {
            return Array.from(SUPPORTED_EXTERN_EXTENSIONS).join(", ");
        }

        public getExternNameText(name: any): string {
            if (typeof name === "string") return name;
            return name?.name ?? name?.value ?? name?.raw ?? "";
        }

        public getExternPathText(path: any): string {
            if (typeof path === "string") return path;
            return path?.raw ?? path?.value ?? "";
        }

        public createExternSource(node: any): string {
            const memberSource = (node.members ?? [])
                .map((member: any) => member.raw ?? member.source ?? "")
                .join("\n");

            return `extern ${this.getExternNameText(node.name)} from "${this.getExternPathText(node.path)}" {\n${memberSource}\n}`;
        }
    };
}
