import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";
import ts from "../ts";

export function TypesSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitAliasTypes(node: any): any {
            console.log(node.kind)
            if (node.kind === Kinds.Types.TypeDeclaration) {
                return this.visitTypeDeclaration(node);
            }

            if (node.kind === Kinds.Types.InterfaceDeclaration) {
                return this.visitInterfaceDeclaration(node);
            }

            return null
        }

        public visitTypeDeclaration(node: any): any {
            this.typeDeclarationDiagnostics(node);

            const members = this.checkTypeMembers(node);
            const linkageName = node.export ? this.getLinkageName(this.modulePath.relativePath, node.name) : null;
            const qualifiedName = this.getQualifiedName(this.modulePath.relativePath, node.name);

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Type,
                name: node.name,
                type: node.type,
                mutable: false,
                storage: null,
                escapes: false,
                linkageName,
                qualifiedName,
                node
            });

            return Object.assign(node, {
                kind: Kinds.Types.TypeDeclaration,
                name: node.name,

                type: Object.assign(node.type, {
                    members,
                }),

                symbolId: symbol.id,
                scopeId: symbol.scopeId,

                export: node.export ?? false,
                trusted: true,
            });
        }

        public visitInterfaceDeclaration(node: any): any {
            this.typeDeclarationDiagnostics(node);

            const members = this.checkTypeMembers(node);
            const linkageName = node.export ? this.getLinkageName(this.modulePath.relativePath, node.name) : null;
            const qualifiedName = this.getQualifiedName(this.modulePath.relativePath, node.name);

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Type,
                name: node.name,
                type: node.type,
                mutable: false,
                storage: null,
                escapes: false,
                linkageName,
                qualifiedName,
                node
            });

            return {
                // ...node,
                // name: node.name,
                // type: {
                //     ...node.type,
                //     members,
                // },

                // symbolId: symbol.id,
                // scopeId: symbol.scopeId,

                // export: node.export ?? false,
                // trusted: true,
            };
        }

        public typeDeclarationDiagnostics(context: any): void {
            const scopeSymbol = this.resolveSymbol(context.name);

            if (scopeSymbol) {
                const message = `the type name ${Helpers.RED}'${context.name}'${Helpers.RESET} is defined multiple times`;
                context.arrowLength = context.name.length;

                this.throwError(
                    message,
                    context.position,
                    context.raw ?? context.source,
                    context,
                );
            }

            if (!context.type) {
                const message = `type declaration ${Helpers.RED}'${context.name}'${Helpers.RESET} is missing a type body`;
                context.arrowLength = context.name.length;

                this.throwError(
                    message,
                    context.position,
                    context.raw ?? context.source,
                    context,
                );
            }

            if (context.type.kind !== "TypeLiteral" && context.type.kind !== Kinds.Types.TypeLiteral) {
                const message = `type declaration ${Helpers.RED}'${context.name}'${Helpers.RESET} must be initialized with a type literal`;
                context.arrowLength = context.name.length;

                this.throwError(
                    message,
                    context.position,
                    context.raw ?? context.source,
                    context,
                );
            }
        }

        public checkTypeMembers(context: any): any[] {
            const members = context.type?.members ?? [];
            const names = new Map<string, any>();

            return members.map((member: any) => {
                if (member.kind !== "PropertySignature" && member.kind !== Kinds.Types.PropertySignature) {
                    const message = `invalid member in type declaration ${Helpers.RED}'${context.name}'${Helpers.RESET}`;
                    member.arrowLength = member.raw?.length ?? 1;

                    this.throwError(
                        message,
                        member.position ?? context.position,
                        context.raw ?? context.source,
                        member,
                    );
                }

                if (names.has(member.name)) {
                    const message = `property ${Helpers.RED}'${member.name}'${Helpers.RESET} is defined multiple times in type ${Helpers.RED}'${context.name}'${Helpers.RESET}`;
                    member.arrowLength = member.name.length;

                    this.throwError(
                        message,
                        member.position,
                        context.raw ?? context.source,
                        member,
                    );
                }

                names.set(member.name, member);

                if (!member.type || member.type.kind === Kinds.Types.UnTyped) {
                    const message = `property ${Helpers.RED}'${member.name}'${Helpers.RESET} is missing a type annotation`;
                    member.arrowLength = member.name.length;

                    this.throwError(
                        message,
                        member.position,
                        context.raw ?? context.source,
                        member,
                    );
                }

                return Object.assign(member, {
                    trusted: true,
                });
            });
        }
    };
}