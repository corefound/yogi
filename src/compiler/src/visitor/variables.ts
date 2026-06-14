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

            const declarations = declarationList.declarations.flatMap((d) => {
                const declaration = this.transformDeclaration(d);
                const declarationList = Array.isArray(declaration) ? declaration : [declaration];

                if (isExported) {
                    for (const item of declarationList) {
                        if (!item) continue;

                        this.exports.set(item.name ?? d.name.getText(), {
                            kind: item.kind,
                            type:
                                item.kind === Kinds.Statements.VariableDeclaration
                                    ? item.type
                                    : item.returnType,
                        });
                    }
                }

                return declarationList;
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

            if (ts.isObjectBindingPattern(declaration.name) || ts.isArrayBindingPattern(declaration.name)) {
                return this.transformBindingPatternDeclaration(declaration, context);
            }

            const baseDeclaration = {
                name,
                flag: context.flag,
                export: context.export,
                declare: context.declare,
                ambient: context.ambient,
                emit: context.emit,
                definiteAssignment: declaration.exclamationToken !== undefined,
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
                    kind: Kinds.Statements.VariableDeclaration,
                    ...baseDeclaration,
                    type: this.visitType(declaration.type),
                    value: this.visitNode(init),
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
                return {
                    kind: Kinds.Statements.VariableDeclaration,
                    ...baseDeclaration,
                    type: this.visitType(declaration.type),
                    value: this.visitNode(init),
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

        public transformBindingPatternDeclaration(
            declaration: ts.VariableDeclaration,
            context: VariableDeclarationContext,
        ): any[] {
            const init = declaration.initializer;
            const declaredType = this.visitType(declaration.type);

            const base = {
                flag: context.flag,
                export: context.export,
                declare: context.declare,
                ambient: context.ambient,
                emit: context.emit,
                definiteAssignment: declaration.exclamationToken !== undefined,
                fullSource: context.fullSource,
                position: this.getNodePosistion(declaration),
            };

            if (!init) {
                return [{
                    kind: Kinds.Statements.VariableDeclaration,
                    ...base,
                    name: declaration.name.getText(),
                    type: declaredType,
                    value: null,
                    source: declaration.getText(),
                }];
            }

            const object = {
                ...this.visitNode(init),
                declaredType,
            };

            if (ts.isObjectBindingPattern(declaration.name)) {
                return this.expandObjectBindingPattern(declaration.name, declaredType, object, base);
            }

            if (ts.isArrayBindingPattern(declaration.name)) {
                return this.expandArrayBindingPattern(declaration.name, declaredType, object, base);
            }

            return [];
        }

        public expandObjectBindingPattern(pattern: ts.ObjectBindingPattern, declaredType: any, object: any, base: any): any[] {
            return pattern.elements.flatMap((element) => {
                if (element.dotDotDotToken) {
                    throw new Error("object rest bindings are not supported yet");
                }

                const propertyName = element.propertyName?.getText() ?? element.name.getText();
                const propertyType = this.getObjectBindingPropertyType(declaredType, propertyName);
                const bindingType = element.initializer
                    ? this.getDefaultedBindingType(propertyType)
                    : propertyType;
                const accessValue = {
                    kind: Kinds.Expressions.PropertyAccessExpression,
                    object,
                    property: propertyName,
                    source: `${object.source ?? "value"}.${propertyName}`,
                    position: this.getNodePosistion(element),
                };
                const value = element.initializer
                    ? {
                        kind: Kinds.Expressions.BinaryExpression,
                        left: accessValue,
                        operator: "??",
                        right: this.visitNode(element.initializer),
                        source: `${accessValue.source} ?? ${element.initializer.getText()}`,
                        fullSource: element.getText(),
                        position: this.getNodePosistion(element),
                    }
                    : accessValue;

                if (ts.isIdentifier(element.name)) {
                    return [{
                        kind: Kinds.Statements.VariableDeclaration,
                        ...base,
                        name: element.name.getText(),
                        type: bindingType,
                        value,
                        source: element.getText(),
                        position: this.getNodePosistion(element),
                    }];
                }

                if (ts.isObjectBindingPattern(element.name)) {
                    return this.expandObjectBindingPattern(element.name, bindingType, value, base);
                }

                return this.expandArrayBindingPattern(element.name, bindingType, value, base);
            });
        }

        public expandArrayBindingPattern(pattern: ts.ArrayBindingPattern, declaredType: any, object: any, base: any): any[] {
            return pattern.elements.flatMap((element, index) => {
                if (ts.isOmittedExpression(element)) {
                    return [];
                }

                if (ts.isBindingElement(element) && element.dotDotDotToken) {
                    throw new Error("array rest bindings are not supported yet");
                }

                const bindingName = ts.isBindingElement(element) ? element.name : element;
                const elementType = this.getArrayBindingElementType(declaredType, index);
                const bindingType = ts.isBindingElement(element) && element.initializer
                    ? this.getDefaultedBindingType(elementType)
                    : elementType;
                const accessValue = {
                    kind: Kinds.Expressions.ElementAccessExpression,
                    object,
                    index: {
                        kind: Kinds.Literals.NumberLiteral,
                        type: "number",
                        value: index,
                        source: String(index),
                        position: this.getNodePosistion(element),
                    },
                    source: `${object.source ?? "value"}[${index}]`,
                    position: this.getNodePosistion(element),
                };
                const value = ts.isBindingElement(element) && element.initializer
                    ? {
                        kind: Kinds.Expressions.BinaryExpression,
                        left: accessValue,
                        operator: "??",
                        right: this.visitNode(element.initializer),
                        source: `${accessValue.source} ?? ${element.initializer.getText()}`,
                        fullSource: element.getText(),
                        position: this.getNodePosistion(element),
                    }
                    : accessValue;

                if (ts.isIdentifier(bindingName)) {
                    return [{
                        kind: Kinds.Statements.VariableDeclaration,
                        ...base,
                        name: bindingName.getText(),
                        type: bindingType,
                        value,
                        source: element.getText(),
                        position: this.getNodePosistion(element),
                    }];
                }

                if (ts.isObjectBindingPattern(bindingName)) {
                    return this.expandObjectBindingPattern(bindingName, bindingType, value, base);
                }

                return this.expandArrayBindingPattern(bindingName, bindingType, value, base);
            });
        }

        public getObjectBindingPropertyType(type: any, propertyName: string): any {
            const members = type?.members ?? type?.body?.members ?? [];
            const property = members.find((member: any) => {
                const name = member?.name;
                return (
                    name === propertyName ||
                    name?.name === propertyName ||
                    name?.value === propertyName ||
                    name?.raw === propertyName
                );
            });

            return property?.type ?? {
                kind: Kinds.Types.UnknownType,
                raw: "unknown",
            };
        }

        public getArrayBindingElementType(type: any, index: number): any {
            if (type?.kind === Kinds.Types.TupleType) {
                return type.elements?.[index] ?? {
                    kind: Kinds.Types.UnknownType,
                    raw: "unknown",
                };
            }

            if (type?.kind === Kinds.Types.ArrayType) {
                return type.elementType;
            }

            return {
                kind: Kinds.Types.UnknownType,
                raw: "unknown",
            };
        }

        public getDefaultedBindingType(type: any): any {
            if (type?.kind !== Kinds.Types.UnionType) {
                return type;
            }

            const types = (type.types ?? []).filter((item: any) => {
                return item?.kind !== Kinds.Types.UndefinedType;
            });

            if (types.length === 0) {
                return {
                    kind: Kinds.Types.NeverType,
                    raw: "never",
                };
            }

            if (types.length === 1) {
                return types[0];
            }

            return {
                ...type,
                types,
                raw: types.map((item: any) => item.raw ?? "unknown").join(" | "),
            };
        }
    };
}
