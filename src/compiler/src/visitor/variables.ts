import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";

export function VariableVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {

        visitVariableDeclaration(node: ts.VariableStatement) {
            const declarationList = node.declarationList;
            const flag = declarationList.flags & ts.NodeFlags.Const
                ? "const"
                : declarationList.flags & ts.NodeFlags.Let
                    ? "let"
                    : "var";

            const isExported = node.modifiers?.some(
                m => m.kind === ts.SyntaxKind.ExportKeyword
            ) ?? false;

            return {
                kind: Kinds.DeclarationStatement,
                flag,
                export: isExported,
                declarations: declarationList.declarations.map(
                    decl => this.transformDeclaration(decl)
                ),
                source: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        transformDeclaration(declaration: ts.VariableDeclaration) {
            const name = declaration.name.getText();
            const init = declaration.initializer;

            // this.handleErrors(declaration);
            if (!init) {
                return {
                    kind: Kinds.VariableDeclaration,
                    name,
                    type: this.visitType(declaration.type),
                    value: null as any,
                    source: declaration.getText(),
                    position: this.getNodePosistion(declaration),
                };
            }

            // -----------------------------------
            // DICTIONARY (OBJECT LITERAL)
            // -----------------------------------
            if (ts.isObjectLiteralExpression(init)) {
                return {
                    kind: Kinds.DictionaryDeclaration,
                    name,
                    type: this.visitType(declaration.type),
                    source: declaration.getText(),
                    position: this.getNodePosistion(declaration),
                    properties: init.properties.flatMap(prop => {
                        if (!ts.isPropertyAssignment(prop)) return [];

                        return [{
                            kind: Kinds.DictionaryProperty,
                            key: prop.name.getText(),
                            value: this.visitNode(prop.initializer)
                        }];
                    })
                };
            }

            // -----------------------------------
            // ARROW FUNCTION
            // -----------------------------------
            if (ts.isArrowFunction(init)) {
                return this.transformFunctionDeclaration(declaration);
            }

            // Binary Expression
            if (ts.isBinaryExpression(init)) {
                return this.visitNode(init);
            }

            // -----------------------------------
            // LITERAL EXPRESSIONS
            // -----------------------------------
            if (ts.isStringLiteral(init) || ts.isNumericLiteral(init) || init.kind === ts.SyntaxKind.TrueKeyword || init.kind === ts.SyntaxKind.FalseKeyword || init.kind === ts.SyntaxKind.NullKeyword) {
                return {
                    kind: Kinds.VariableDeclaration,
                    name,
                    source: declaration.getText(),
                    position: this.getNodePosistion(declaration),
                    type: this.visitType(declaration.type),
                    value: this.visitNode(init)
                };
            }

            // -----------------------------------
            // ARRAY LITERAL
            // -----------------------------------
            if (ts.isArrayLiteralExpression(init)) {
                return this.visitArrayDeclaration(declaration);
            }

            // -----------------------------------
            // DICTIONARY / OBJECT LITERAL
            // -----------------------------------
            if (ts.isObjectLiteralExpression(init)) {
                return this.visitDictionaryDeclaration(declaration);
            }
        }

        visitAssignment(node: ts.BinaryExpression) {
            return {
                kind: Kinds.VariableReassignment,
                name: node.left.getText(),
                value: this.visitNode(node.right),
                source: node.getText(),
                position: this.getNodePosistion(node),
            };
        }
    };
}