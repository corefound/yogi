import ts from "typescript";
import { BaseVisitor, Constructor } from "@/visitor/base";
import { Kinds } from "@/helpers/types";
import { Errors } from "@/loggers/error";

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
                source: node.getFullText(),
                declarations: declarationList.declarations.map(
                    decl => this.transformDeclaration(decl)
                )
            };
        }

        isUnexpectedType = (type: ts.TypeNode) => {
            switch (true) {
                // =========================
                // ❌ TIPOS PROHIBIDOS (DINÁMICOS / INSEGUROS)
                // =========================

                case type.kind == ts.SyntaxKind.AnyKeyword:
                case type.kind == ts.SyntaxKind.UnknownKeyword:
                case type.kind == ts.SyntaxKind.ObjectKeyword:
                case type.kind == ts.SyntaxKind.FunctionType:
                case type.kind == ts.SyntaxKind.ConstructorType:

                // JS/TS escape hatches
                case type.kind == ts.SyntaxKind.MappedType:
                case type.kind == ts.SyntaxKind.IndexedAccessType:
                case type.kind == ts.SyntaxKind.TypeReference &&
                    (type as ts.TypeReferenceNode).typeName.getText() === "Function":

                    return true;

                // =========================
                // ❌ TIPOS AMBIGUOS (opcional en tu modelo estricto)
                // =========================

                case type.kind == ts.SyntaxKind.TypeOperator:
                case type.kind == ts.SyntaxKind.TypeQuery:
                case type.kind == ts.SyntaxKind.TypePredicate:

                    return true;

                // =========================
                // ✔ TIPOS PERMITIDOS (BASE DEL LENGUAJE)
                // =========================

                case type.kind == ts.SyntaxKind.NumberKeyword:
                case type.kind == ts.SyntaxKind.StringKeyword:
                case type.kind == ts.SyntaxKind.BooleanKeyword:
                case type.kind == ts.SyntaxKind.VoidKeyword:

                // Tu sistema estructurado
                case type.kind == ts.SyntaxKind.TypeLiteral:
                case type.kind == ts.SyntaxKind.TypeAliasDeclaration:

                    return false;

                // =========================
                // DEFAULT: seguro en modo estricto
                // =========================

                default:
                    return false;
            }
        };

        handleErrors = (declaration: ts.VariableDeclaration) => {
            if (!declaration.type?.getText()) {
                Errors.typeError(declaration, this.filePath)
            }

            if (this.isUnexpectedType(declaration.type)) {
                Errors.unexpectedTypeError(declaration, this.filePath)
            }
        }

        transformDeclaration(declaration: ts.VariableDeclaration) {
            const name = declaration.name.getText();
            const init = declaration.initializer;

            // this.handleErrors(declaration);

            if (!init) {
                return {
                    kind: Kinds.VariableDeclaration,
                    name,
                    type: declaration.type?.getText() ?? "any",
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
                        type: p.type?.getText() ?? "any"
                    })),
                    body: ts.isBlock(init.body)
                        ? init.body.statements.map(s => this.visitNode(s))
                        : this.visitNode(init.body)
                };
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
                    type: this.inferPrimitiveType(init),
                    value: this.visitNode(init)
                };
            }

        }

        inferPrimitiveType(init: ts.Expression): string {
            switch (init.kind) {
                case ts.SyntaxKind.NumericLiteral:
                    return "number";
                case ts.SyntaxKind.StringLiteral:
                    return "string";
                case ts.SyntaxKind.TrueKeyword:
                case ts.SyntaxKind.FalseKeyword:
                    return "boolean";
                case ts.SyntaxKind.NullKeyword:
                    return "null";
                default:
                    return "any";
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