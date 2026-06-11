import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";

type VariableDeclarationContext = {
    flag: "const" | "let" | "var";
    export: boolean;
    declare: boolean;
    ambient: boolean;
    emit: boolean;
    fullSource: string;
};

export function VariableVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        public variableDeclarationContext: VariableDeclarationContext | null = null;

        public visitVariableDeclaration(node: ts.VariableStatement) {
            const declarationList = node.declarationList;

            const flag =
                declarationList.flags & ts.NodeFlags.Const
                    ? "const"
                    : declarationList.flags & ts.NodeFlags.Let
                        ? "let"
                        : "var";

            const isExported =
                node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ??
                false;

            const isDeclare =
                node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) ??
                false;

            this.variableDeclarationContext = {
                flag,
                export: isExported,
                declare: isDeclare,
                ambient: isDeclare,
                emit: !isDeclare,
                fullSource: node.getText(),
            };

            const declarations = declarationList.declarations.map((d) => {
                const declaration = this.transformDeclaration(d);

                if (isExported && declaration) {
                    this.exports.set(d.name.getText(), {
                        kind: declaration.kind,
                        type:
                            declaration.kind === Kinds.Statements.VariableDeclaration
                                ? declaration.type
                                : declaration.returnType,
                    });
                }

                return declaration;
            });

            this.variableDeclarationContext = null;

            return {
                kind: Kinds.Statements.DeclarationStatement,
                flag,
                export: isExported,
                declare: isDeclare,
                ambient: isDeclare,
                emit: !isDeclare,
                declarations,
                source: node.getText(),
                fullSource: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        public transformDeclaration(declaration: ts.VariableDeclaration) {
            const name = declaration.name.getText();
            const init = declaration.initializer;

            const context =
                this.variableDeclarationContext ?? {
                    flag: "let" as const,
                    export: false,
                    declare: false,
                    ambient: false,
                    emit: true,
                    fullSource: declaration.getText(),
                };

            const baseDeclaration = {
                name,
                flag: context.flag,
                export: context.export,
                declare: context.declare,
                ambient: context.ambient,
                emit: context.emit,
                source: declaration.getText(),
                fullSource: context.fullSource,
                position: this.getNodePosistion(declaration),
            };

            if (!init) {
                return {
                    kind: Kinds.Statements.VariableDeclaration,
                    ...baseDeclaration,
                    type: this.visitType(declaration.type),
                    value: null as any,
                };
            }

            if (ts.isIdentifier(init)) {
                return {
                    kind: Kinds.Statements.VariableDeclaration,
                    ...baseDeclaration,
                    type: this.visitType(declaration.type),
                    value: this.visitNode(init),
                };
            }

            if (ts.isObjectLiteralExpression(init)) {
                return {
                    kind: Kinds.Collections.DictionaryDeclaration,
                    ...baseDeclaration,
                    type: this.visitType(declaration.type),
                    properties: init.properties.flatMap((prop) => {
                        if (!ts.isPropertyAssignment(prop)) return [];

                        return [
                            {
                                kind: Kinds.Collections.DictionaryProperty,
                                key: prop.name.getText(),
                                value: this.visitNode(prop.initializer),
                            },
                        ];
                    }),
                };
            }

            if (ts.isArrowFunction(init)) {
                const fnDeclaration = this.transformFunctionDeclaration(declaration);

                return {
                    ...fnDeclaration,
                    flag: context.flag,
                    export: context.export,
                    declare: context.declare,
                    ambient: context.ambient,
                    emit: context.emit,
                    fullSource: context.fullSource,
                };
            }

            if (
                ts.isStringLiteral(init) ||
                ts.isNumericLiteral(init) ||
                init.kind === ts.SyntaxKind.TrueKeyword ||
                init.kind === ts.SyntaxKind.FalseKeyword ||
                init.kind === ts.SyntaxKind.NullKeyword
            ) {
                return {
                    kind: Kinds.Statements.VariableDeclaration,
                    ...baseDeclaration,
                    type: this.visitType(declaration.type),
                    value: this.visitNode(init),
                };
            }

            if (ts.isArrayLiteralExpression(init)) {
                const arrayDeclaration = this.visitArrayDeclaration(declaration);

                return {
                    ...arrayDeclaration,
                    flag: context.flag,
                    export: context.export,
                    declare: context.declare,
                    ambient: context.ambient,
                    emit: context.emit,
                    fullSource: context.fullSource,
                };
            }

            return {
                kind: Kinds.Statements.VariableDeclaration,
                ...baseDeclaration,
                type: this.visitType(declaration.type),
                value: this.visitNode(init),
            };
        }

        public visitAssignment(node: ts.BinaryExpression) {
            return {
                kind: Kinds.Statements.VariableReassignment,
                name: node.left.getText(),
                value: this.visitNode(node.right),
                source: node.getText(),
                position: this.getNodePosistion(node),
            };
        }
    };
}