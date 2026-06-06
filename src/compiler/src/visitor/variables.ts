import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds, Types } from "../helpers/types";
import { Errors } from "../loggers/error";

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
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
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
                    type: declaration.type?.getText() || "any",
                    value: null as any,
                    source: declaration.getFullText(),
                    position: declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.pos),
                };
            }

            // -----------------------------------
            // DICTIONARY (OBJECT LITERAL)
            // -----------------------------------
            if (ts.isObjectLiteralExpression(init)) {
                return {
                    kind: Kinds.DictionaryDeclaration,
                    name,
                    type: "dictionary",
                    source: declaration.getFullText(),
                    position: declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.pos),
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
                return {
                    kind: Kinds.FunctionDeclaration,
                    name,
                    type: "function",
                    source: declaration.getFullText(),
                    position: declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.pos),
                    params: init.parameters.map(p => ({
                        name: p.name.getText(),
                        type: p.type?.getText() ?? "any",
                        source: p.getFullText(),
                        position: p.getSourceFile().getLineAndCharacterOfPosition(p.pos),
                    })),
                    body: ts.isBlock(init.body)
                        ? init.body.statements.map(s => this.visitNode(s))
                        : this.visitNode(init.body)
                };
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
                    source: declaration.getFullText(),
                    position: declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.pos),
                    type: declaration.type?.getText() ?? Types.Any,
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
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }
    };
}