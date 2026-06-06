import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds, Types } from "../helpers/types";

export function FunctionVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {

        visitFunctions(node: ts.Node) {
            if (ts.isFunctionDeclaration(node)) return this.visitFunctionDeclaration(node);
            if (ts.isArrowFunction(node)) return this.visitArrowFunction(node);
            if (ts.isReturnStatement(node)) return this.visitReturnStatement(node);
        }

        // -----------------------------------
        // REGULAR FUNCTION DECLARATION
        // function sum(a: number): number {}
        // -----------------------------------
        visitFunctionDeclaration(node: ts.FunctionDeclaration) {
            return {
                kind: Kinds.FunctionDeclaration,
                name: node.name?.getText() ?? "anonymous",
                params: node.parameters.map(param => this.visitFunctionParameter(param)),
                returnType: this.visitType(node.type),
                body: node.body
                    ? this.visitFunctionBlock(node.body)
                    : null,
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }

        // -----------------------------------
        // VARIABLE ARROW FUNCTION DECLARATION
        // const sum = (a: number): number => {}
        // -----------------------------------
        transformFunctionDeclaration(declaration: ts.VariableDeclaration) {
            const name = declaration.name.getText();
            const init = declaration.initializer;

            if (!init || !ts.isArrowFunction(init)) {
                return null;
            }

            return this.visitArrowFunctionDeclaration(name, init, declaration);
        }

        visitArrowFunctionDeclaration(
            name: string,
            node: ts.ArrowFunction,
            declaration: ts.VariableDeclaration
        ) {
            return {
                kind: Kinds.FunctionDeclaration,
                name,
                type: "function",
                params: node.parameters.map(param => this.visitFunctionParameter(param)),
                returnType: this.visitType(node.type),
                body: this.visitFunctionBody(node.body),
                source: declaration.getFullText(),
                position: declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.pos),
            };
        }

        // -----------------------------------
        // PARAMS
        // -----------------------------------
        visitFunctionParameter(param: ts.ParameterDeclaration) {
            return {
                kind: Kinds.FunctionParameter,
                name: param.name.getText(),
                type: this.visitType(param.type),
                source: param.getFullText(),
                position: param.getSourceFile().getLineAndCharacterOfPosition(param.pos),
            };
        }

        // -----------------------------------
        // BODY FOR REGULAR FUNCTION
        // -----------------------------------
        visitFunctionBlock(body: ts.Block) {
            return {
                kind: Kinds.BlockStatement,
                statements: body.statements.map(statement => this.visitNode(statement)),
                source: body.getFullText(),
                position: body.getSourceFile().getLineAndCharacterOfPosition(body.pos),
            };
        }

        // -----------------------------------
        // BODY FOR ARROW FUNCTION
        // Supports:
        // const sum = () => {}
        // const sum = () => 1 + 2
        // -----------------------------------
        visitFunctionBody(body: ts.ConciseBody) {
            if (ts.isBlock(body)) {
                return this.visitFunctionBlock(body);
            }

            return {
                kind: Kinds.ExpressionBody,
                expression: this.visitNode(body),
                source: body.getFullText(),
                position: body.getSourceFile().getLineAndCharacterOfPosition(body.pos),
            };
        }

        // -----------------------------------
        // RETURN STATEMENT
        // return value;
        // -----------------------------------
        visitReturnStatement(node: ts.ReturnStatement) {
            return {
                kind: Kinds.ReturnStatement,
                value: node.expression ? this.visitNode(node.expression) : null,
                source: node.getFullText(),
                position: node.getSourceFile().getLineAndCharacterOfPosition(node.pos),
            };
        }
    };
}