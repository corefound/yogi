import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function TypesSemantic<TBase extends Constructor<BaseSemantic>>(
    base: TBase,
) {
    return class extends base {
        public visitAliasTypes(node: any): any {
            switch (node.kind) {
                case Kinds.Types.TypeDeclaration:
                case "TypeDeclaration":
                    return this.visitTypeDeclaration(node);

                case Kinds.Types.InterfaceDeclaration:
                case "InterfaceDeclaration":
                    return this.visitInterfaceDeclaration(node);

                default:
                    return null;
            }
        }

        public visitTypeDeclaration(node: any): any {
            return this.visitTypeLikeDeclaration(node, "type");
        }

        public visitInterfaceDeclaration(node: any): any {
            return this.visitTypeLikeDeclaration(node, "interface");
        }

        public visitTypeLikeDeclaration(
            node: any,
            declarationKind: "type" | "interface",
        ): any {
            this.typeLikeDeclarationDiagnostics(node, declarationKind);

            const members = this.checkTypeMembers(node, declarationKind);
            const localSymbol = this.resolveLocalSymbol(node.name);

            const isInterfaceSymbol =
                localSymbol?.kind === Kinds.ScopeSymbols.Interface;

            if (declarationKind === "interface" && isInterfaceSymbol) {
                return this.mergeInterfaceDeclaration(node, localSymbol, members);
            }

            const linkageName = node.export
                ? this.getLinkageName(this.modulePath.relativePath, node.name)
                : null;

            const qualifiedName = this.getQualifiedName(
                this.modulePath.relativePath,
                node.name,
            );

            const declarationInfo = this.getDeclarationInfo(node, members);

            const semanticNode = {
                ...node,

                kind:
                    declarationKind === "interface"
                        ? Kinds.Types.InterfaceDeclaration
                        : Kinds.Types.TypeDeclaration,

                declarationKind,

                type: {
                    ...node.type,
                    members,
                },

                export: node.export ?? false,
                linkageName,
                qualifiedName,

                trusted: true,
                merged: false,
                declarations: [declarationInfo],
            };

            const symbol = this.defineSymbol({
                kind:
                    declarationKind === "interface"
                        ? Kinds.ScopeSymbols.Interface
                        : Kinds.ScopeSymbols.Type,

                name: node.name,
                type: semanticNode.type,
                mutable: false,
                storage: null,
                escapes: false,
                linkageName,
                qualifiedName,
                node: null,
            });

            semanticNode.symbolId = symbol.id;
            semanticNode.scopeId = symbol.scopeId;

            symbol.node = semanticNode;

            return semanticNode;

            return {
                ...semanticNode,
                symbolId: symbol.id,
                scopeId: symbol.scopeId,
            };
        }

        public typeLikeDeclarationDiagnostics(
            context: any,
            declarationKind: "type" | "interface",
        ): void {
            const localSymbol = this.resolveLocalSymbol(context.name);

            if (localSymbol) {
                const canMerge =
                    declarationKind === "interface" &&
                    localSymbol.kind === Kinds.ScopeSymbols.Interface;

                if (canMerge) return;

                const message =
                    `${declarationKind} name ${Helpers.RED}'${context.name}'${Helpers.RESET} is defined multiple times`;

                context.arrowLength = context.name.length;

                this.throwError(
                    message,
                    context.position,
                    context.raw ?? context.source,
                    context,
                );
            }

            if (!context.type) {
                const message =
                    `${declarationKind} declaration ${Helpers.RED}'${context.name}'${Helpers.RESET} is missing a type body`;

                context.arrowLength = context.name.length;

                this.throwError(
                    message,
                    context.position,
                    context.raw ?? context.source,
                    context,
                );
            }

            if (
                context.type.kind !== "TypeLiteral" &&
                context.type.kind !== Kinds.Types.TypeLiteral
            ) {
                const message =
                    `${declarationKind} declaration ${Helpers.RED}'${context.name}'${Helpers.RESET} must be initialized with a type literal`;

                context.arrowLength = context.name.length;

                this.throwError(
                    message,
                    context.position,
                    context.raw ?? context.source,
                    context,
                );
            }
        }

        public checkTypeMembers(
            context: any,
            declarationKind: "type" | "interface",
        ): any[] {
            const members = context.type?.members ?? [];
            const names = new Map<string, any>();

            return members.map((member: any) => {
                const isProperty =
                    member.kind === Kinds.Types.PropertySignature ||
                    member.kind === "PropertySignature";

                if (!isProperty) {
                    const message =
                        `invalid member in ${declarationKind} declaration ` +
                        `${Helpers.RED}'${context.name}'${Helpers.RESET}`;

                    member.arrowLength = member.raw?.length ?? 1;

                    this.throwError(
                        message,
                        member.position ?? context.position,
                        context.raw ?? context.source,
                        member,
                    );
                }

                if (names.has(member.name)) {
                    const message =
                        `property ${Helpers.RED}'${member.name}'${Helpers.RESET} is defined multiple times in ` +
                        `${declarationKind} ${Helpers.RED}'${context.name}'${Helpers.RESET}`;

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
                    const message =
                        `property ${Helpers.RED}'${member.name}'${Helpers.RESET} is missing a type annotation`;

                    member.arrowLength = member.name.length;

                    this.throwError(
                        message,
                        member.position,
                        context.raw ?? context.source,
                        member,
                    );
                }

                return {
                    ...member,
                    trusted: true,
                };
            });
        }

        public mergeInterfaceDeclaration(
            node: any,
            symbol: any,
            newMembers: any[],
        ): any[] {
            const existingNode = symbol.node;
            const existingMembers = existingNode.type?.members ?? [];

            for (const member of newMembers) {
                const duplicated = existingMembers.find(
                    (existing: any) => existing.name === member.name,
                );

                if (duplicated) {
                    const message =
                        `property ${Helpers.RED}'${member.name}'${Helpers.RESET} is already declared in interface ` +
                        `${Helpers.RED}'${node.name}'${Helpers.RESET}`;

                    member.arrowLength = member.name.length;

                    this.throwError(
                        message,
                        member.position,
                        node.raw ?? node.source,
                        member,
                    );
                }
            }

            const declarationInfo = this.getDeclarationInfo(node, newMembers);
            const mergedMembers = [...existingMembers, ...newMembers];

            existingNode.type = {
                ...existingNode.type,
                members: mergedMembers,
            };

            existingNode.merged = true;
            existingNode.declarations = [
                ...(existingNode.declarations ?? []),
                declarationInfo,
            ];

            symbol.type = existingNode.type;
            symbol.node = existingNode;

            return [];
        }

        public getDeclarationInfo(node: any, members: any[] = []): any {
            return {
                kind: node.kind,
                name: node.name,
                raw: node.raw ?? node.source,
                position: node.position,
                members: members.map((member: any) => ({
                    kind: member.kind,
                    name: member.name,
                    optional: member.optional ?? false,
                    type: member.type,
                    raw: member.raw,
                    position: member.position,
                    trusted: member.trusted ?? true,
                })),
            };
        }
    };
}