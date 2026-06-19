import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";

export function LoopVisitor<TBase extends Constructor<BaseVisitor>>(base: TBase) {
    return class extends base {
        public forOfCounter = 0;

        visitLoops(node: ts.Node) {
            if (ts.isWhileStatement(node)) {
                return this.visitWhileStatement(node);
            }

            if (ts.isForStatement(node)) {
                return this.visitForStatement(node);
            }

            if (ts.isForOfStatement(node)) {
                return this.visitForOfStatement(node);
            }

            if (ts.isBreakStatement(node)) {
                return this.visitBreakStatement(node);
            }

            if (ts.isContinueStatement(node)) {
                return this.visitContinueStatement(node);
            }
        }

        visitWhileStatement(node: ts.WhileStatement) {
            return {
                kind: Kinds.ControlFlow.WhileStatement,
                condition: this.visitNode(node.expression),
                body: this.visitLoopBody(node.statement),
                source: node.getText(),
                position: this.getNodePosistion(node)
            };
        }

        visitForStatement(node: ts.ForStatement) {
            return {
                kind: Kinds.ControlFlow.ForStatement,
                initializer: node.initializer
                    ? this.visitForInitializer(node.initializer)
                    : null,
                condition: node.condition
                    ? this.visitNode(node.condition)
                    : null,
                incrementor: node.incrementor
                    ? this.visitNode(node.incrementor)
                    : null,
                body: this.visitLoopBody(node.statement),
                source: node.getText(),
                position: this.getNodePosistion(node)
            };
        }

        visitForInitializer(initializer: ts.ForInitializer) {
            if (ts.isVariableDeclarationList(initializer)) {
                return {
                    kind: Kinds.Statements.DeclarationStatement,
                    flag: initializer.flags & ts.NodeFlags.Const
                        ? "const"
                        : initializer.flags & ts.NodeFlags.Let
                            ? "let"
                            : "var",
                    export: false,
                    declarations: initializer.declarations.map(decl =>
                        this.transformDeclaration(decl)
                    ),
                    source: initializer.getText(),
                    position: this.getNodePosistion(initializer),
                };
            }

            return this.visitNode(initializer);
        }

        visitForOfStatement(node: ts.ForOfStatement) {
            if (!ts.isVariableDeclarationList(node.initializer)) {
                throw new Error("for...of initializer must declare a loop variable");
            }

            const declaration = node.initializer.declarations[0];
            if (
                !declaration ||
                (
                    !ts.isIdentifier(declaration.name) &&
                    !ts.isArrayBindingPattern(declaration.name) &&
                    !ts.isObjectBindingPattern(declaration.name)
                )
            ) {
                throw new Error("for...of currently supports identifier and destructuring loop bindings");
            }

            const elementType = declaration.type ? this.visitType(declaration.type) : null;
            const iterableElementType = elementType ?? { kind: Kinds.Types.AnyType, raw: "any" };
            const indexName = `__yogi_for_of_index_${this.forOfCounter}`;
            const iterableName = `__yogi_for_of_iterable_${this.forOfCounter}`;
            this.forOfCounter++;

            const iterable = this.visitNode(node.expression);
            const indexIdentifier = this.createSyntheticIdentifier(indexName, node);
            const iterableIdentifier = this.createSyntheticIdentifier(iterableName, node.expression);
            const arrayType = {
                kind: Kinds.Types.ArrayType,
                raw: `${iterableElementType.raw}[]`,
                elementType: iterableElementType,
                readonly: false,
            };

            const initializer = {
                kind: Kinds.Statements.DeclarationStatement,
                flag: "let",
                export: false,
                declare: false,
                ambient: false,
                emit: true,
                declarations: [
                    {
                        kind: Kinds.Statements.VariableDeclaration,
                        name: iterableName,
                        flag: "let",
                        export: false,
                        declare: false,
                        ambient: false,
                        emit: true,
                        definiteAssignment: false,
                        type: arrayType,
                        value: iterable,
                        source: `${iterableName}: ${arrayType.raw} = ${node.expression.getText()}`,
                        fullSource: node.getText(),
                        position: this.getNodePosistion(node.expression),
                    },
                    {
                        kind: Kinds.Statements.VariableDeclaration,
                        name: indexName,
                        flag: "let",
                        export: false,
                        declare: false,
                        ambient: false,
                        emit: true,
                        definiteAssignment: false,
                        type: { kind: Kinds.Types.NumberType, raw: "number" },
                        value: {
                            kind: Kinds.Literals.NumberLiteral,
                            type: "number",
                            value: 0,
                            source: "0",
                            position: this.getNodePosistion(node),
                        },
                        source: `${indexName}: number = 0`,
                        fullSource: node.getText(),
                        position: this.getNodePosistion(node),
                    },
                ],
                source: `let ${iterableName}: ${arrayType.raw} = ${node.expression.getText()}, ${indexName}: number = 0`,
                fullSource: node.getText(),
                position: this.getNodePosistion(node),
            };

            const condition = {
                kind: Kinds.Expressions.BinaryExpression,
                left: indexIdentifier,
                operator: "<",
                right: {
                    kind: Kinds.Expressions.PropertyAccessExpression,
                    object: iterableIdentifier,
                    property: "length",
                    optional: false,
                    source: `${iterableName}.length`,
                    position: this.getNodePosistion(node.expression),
                },
                source: `${indexName} < ${iterableName}.length`,
                fullSource: node.getText(),
                position: this.getNodePosistion(node),
            };

            const incrementor = {
                kind: Kinds.Expressions.BinaryExpression,
                left: indexIdentifier,
                operator: "=",
                right: {
                    kind: Kinds.Expressions.BinaryExpression,
                    left: indexIdentifier,
                    operator: "+",
                    right: {
                        kind: Kinds.Literals.NumberLiteral,
                        type: "number",
                        value: 1,
                        source: "1",
                        position: this.getNodePosistion(node),
                    },
                    source: `${indexName} + 1`,
                    fullSource: node.getText(),
                    position: this.getNodePosistion(node),
                },
                source: `${indexName} = ${indexName} + 1`,
                fullSource: node.getText(),
                position: this.getNodePosistion(node),
            };

            const valueAccess = {
                kind: Kinds.Expressions.ElementAccessExpression,
                object: iterableIdentifier,
                index: indexIdentifier,
                optional: false,
                source: `${iterableName}[${indexName}]`,
                position: this.getNodePosistion(node.expression),
            };
            const valueDeclarations = this.createForOfValueDeclarations(
                node,
                declaration,
                elementType,
                valueAccess,
            );
            const body = this.visitLoopBody(node.statement);

            return {
                kind: Kinds.ControlFlow.ForStatement,
                initializer,
                condition,
                incrementor,
                body: {
                    ...body,
                    statements: [...valueDeclarations, ...(body.statements ?? [])],
                },
                source: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        createSyntheticIdentifier(name: string, node: ts.Node) {
            return {
                kind: Kinds.Expressions.IdentifierExpression,
                type: "identifier",
                value: name,
                source: name,
                fullSource: node.getFullText(),
                position: this.getNodePosistion(node),
            };
        }

        createForOfValueDeclarations(
            node: ts.ForOfStatement,
            declaration: ts.VariableDeclaration,
            elementType: any,
            valueAccess: any,
        ) {
            const flag = node.initializer.flags & ts.NodeFlags.Const ? "const" : "let";
            const base = {
                flag,
                export: false,
                declare: false,
                ambient: false,
                emit: true,
                definiteAssignment: false,
                fullSource: node.getText(),
                position: this.getNodePosistion(declaration),
            };

            if (ts.isIdentifier(declaration.name)) {
                return [{
                    kind: Kinds.Statements.DeclarationStatement,
                    flag,
                    export: false,
                    declare: false,
                    ambient: false,
                    emit: true,
                    declarations: [{
                        kind: Kinds.Statements.VariableDeclaration,
                        ...base,
                        name: declaration.name.getText(),
                        type: elementType,
                        value: valueAccess,
                        source: `${declaration.name.getText()}: ${elementType?.raw ?? "unknown"} = ${valueAccess.source}`,
                    }],
                    source: `${declaration.name.getText()}: ${elementType?.raw ?? "unknown"} = ${valueAccess.source}`,
                    fullSource: node.getText(),
                    position: this.getNodePosistion(declaration),
                }];
            }

            const tempName = `__yogi_for_of_value_${this.forOfCounter++}`;
            const tempIdentifier = this.createSyntheticIdentifier(tempName, declaration);
            const tempDeclaration = {
                kind: Kinds.Statements.DeclarationStatement,
                flag: "let",
                export: false,
                declare: false,
                ambient: false,
                emit: true,
                declarations: [{
                    kind: Kinds.Statements.VariableDeclaration,
                    ...base,
                    flag: "let",
                    name: tempName,
                    type: elementType,
                    value: valueAccess,
                    source: `${tempName}: ${elementType?.raw ?? "unknown"} = ${valueAccess.source}`,
                }],
                source: `${tempName}: ${elementType?.raw ?? "unknown"} = ${valueAccess.source}`,
                fullSource: node.getText(),
                position: this.getNodePosistion(declaration),
            };
            const visitor = this as any;
            const bindingDeclarations = ts.isArrayBindingPattern(declaration.name)
                ? visitor.expandArrayBindingPattern(declaration.name, elementType, tempIdentifier, base)
                : visitor.expandObjectBindingPattern(declaration.name, elementType, tempIdentifier, base);

            return [
                tempDeclaration,
                {
                    kind: Kinds.Statements.DeclarationStatement,
                    flag,
                    export: false,
                    declare: false,
                    ambient: false,
                    emit: true,
                    declarations: bindingDeclarations,
                    source: declaration.name.getText(),
                    fullSource: node.getText(),
                    position: this.getNodePosistion(declaration),
                },
            ];
        }

        visitLoopBody(statement: ts.Statement) {
            if (ts.isBlock(statement)) {
                return this.visitBlockStatement(statement);
            }

            return {
                kind: Kinds.Statements.BlockStatement,
                statements: [this.visitNode(statement)],
                source: statement.getText(),
                position: this.getNodePosistion(statement),
            };
        }

        visitBlockStatement(block: ts.Block) {
            return {
                kind: Kinds.Statements.BlockStatement,
                statements: block.statements.map(statement => this.visitNode(statement)),
                source: block.getText(),
                position: this.getNodePosistion(block),
            };
        }

        visitBreakStatement(node: ts.BreakStatement) {
            return {
                kind: Kinds.ControlFlow.BreakStatement,
                source: node.getText(),
                position: this.getNodePosistion(node),
            };
        }

        visitContinueStatement(node: ts.ContinueStatement) {
            return {
                kind: Kinds.ControlFlow.ContinueStatement,
                source: node.getText(),
                position: this.getNodePosistion(node),
            };
        }
    };
}
