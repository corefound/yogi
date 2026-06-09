import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function VariablesSemantic<TBase extends Constructor<BaseSemantic>>(base: TBase) {
    return class extends base {
        public visitDeclarationStatement(node: any) {
            if (node.kind !== Kinds.Statements.DeclarationStatement) {
                return null;
            }

            return node.declarations.map((declaration: any) =>
                this.visitVariableLikeDeclarations(
                    Object.assign(declaration, {
                        flag: {
                            name: node.flag,
                            position: node.position,
                        },
                        export: node.export,
                        fullSource: node.source,
                        source: declaration.source,
                    }),
                ),
            );
        }

        public visitVariableLikeDeclarations(node: any): any {
            switch (node.kind) {
                case Kinds.Statements.VariableDeclaration:
                    return this.visitVariableDeclarations(node);

                default:
                    return this.visitNode(node);
            }
        }
        public visitVariableDeclarations(node: any) {
            const value = node.value ? this.visitNode(node.value) : null;
            const context = Object.assign(node, { value });

            const { trusted } = this.declarationDiagnostics(context);
            const linkageName = this.getLinkageName(this.modulePath.relativePath, node.name);
            const qualifiedName = this.getQualifiedName(this.modulePath.relativePath, node.name);

            const symbol = this.defineSymbol({
                kind: Kinds.ScopeSymbols.Function,
                name: node.name,
                linkageName,
                qualifiedName,
                type: node.type,
                mutable: node.flag.name !== "const",
                storage: Kinds.Storage.stack,
                escapes: false,
                trusted,
                node: value
            });

            return Object.assign(node, {
                kind: Kinds.Statements.VariableDeclaration,
                symbolId: symbol.id,
                scopeId: symbol.scopeId,

                flag: node.flag,
                export: node.export,
                mutable: symbol.mutable,
                type: node.type,

                storage: symbol.storage,
                escapes: symbol.escapes,
                trusted,

                value,
            });
        }


        public declarationDiagnostics(context: any): any {
            let trusted = true;
            let value = context.value;
            if (context.value.kind == Kinds.Expressions.BinaryExpression) {
                value = this.checkBinaryExpression(context);
            }

            if (context.type.kind == Kinds.Types.UnTyped) {
                this.throwError(
                    Kinds.ErrrorsMessage.MissingType,
                    context.position,
                    context.fullSource,
                    context,
                );
            }

            if (context.flag.name != "const" && context.flag.name != "let") {
                const message = `${Helpers.RED}'${context.flag.name}'${Helpers.RESET} declarations are not allowed`;
                context.arrowLength = context.flag.name.length;
                this.throwError(
                    message,
                    context.flag.position,
                    context.fullSource,
                    context,
                    "  = use 'let' for mutable bindings\n  = use 'const' for immutable bindings",
                );
            }

            const scopeSymbol = this.resolveSymbol(context.name);
            if (scopeSymbol) {
                const message = `the name ${Helpers.RED}'${context.name}'${Helpers.RESET} is defined multiple times`;
                context.arrowLength = context.name.length;
                this.throwError(message, context.position, context.fullSource, context);
            }

            if (!this.checkDataType(context.type.kind, value)) {
                const message = `name ${Helpers.BLUE}'${context.name}'${Helpers.RESET} can only initialize values of type ${Helpers.BLUE}'${context.type.raw}'${Helpers.RESET}`;
                context.arrowLength = context.name.length + 1;
                this.throwError(message, context.position, context.fullSource, context);
            }

            return { trusted };
        }

        public checkDataType(expectedType: any, value: any): boolean {
            if (!value?.type) return false;

            return expectedType === value.type.kind;
        }

        public checkBinaryExpression(context: any): any {
            const checkExpression = (node: any): any => {
                if (!node) return null;

                switch (node.kind) {
                    case Kinds.Expressions.BinaryExpression:
                    case "BinaryExpression":
                        return checkBinary(node);

                    default:
                        return node;
                }
            };

            const checkBinary = (node: any): any => {
                const left = checkExpression(node.left);
                const right = checkExpression(node.right);

                const leftType = left?.type;
                const rightType = right?.type;

                const isNumber = (type: any) => type?.kind === Kinds.Types.NumberType;
                const isString = (type: any) => type?.kind === Kinds.Types.StringType;
                const isBoolean = (type: any) => type?.kind === Kinds.Types.BooleanType;

                const done = (type: any) => {
                    return Object.assign(node, {
                        left,
                        right,
                        type,
                    });
                };

                const fail = () => {
                    const message =
                        `operator ${Helpers.RED}'${node.operator}'${Helpers.RESET} cannot be applied to types ` +
                        `${Helpers.RED}'${leftType?.raw}'${Helpers.RESET} and ` +
                        `${Helpers.RED}'${rightType?.raw}'${Helpers.RESET}`;

                    node.arrowLength = node.source?.length ?? 1;
                    this.throwError(message, node.position, context.fullSource, node);
                };

                switch (node.operator) {
                    case "+": {
                        if (isNumber(leftType) && isNumber(rightType)) {
                            return done({ kind: Kinds.Types.NumberType, raw: "number" });
                        }

                        if (isString(leftType) && isString(rightType)) {
                            return done({ kind: Kinds.Types.StringType, raw: "string" });
                        }

                        fail();
                    }

                    case "-":
                    case "*":
                    case "/":
                    case "%": {
                        if (isNumber(leftType) && isNumber(rightType)) {
                            return done({ kind: Kinds.Types.NumberType, raw: "number" });
                        }

                        fail();
                    }

                    case "<":
                    case "<=":
                    case ">":
                    case ">=": {
                        if (isNumber(leftType) && isNumber(rightType)) {
                            return done({ kind: Kinds.Types.BooleanType, raw: "boolean" });
                        }

                        fail();
                    }

                    case "==":
                    case "!=":
                    case "===":
                    case "!==": {
                        if (leftType?.kind === rightType?.kind) {
                            return done({ kind: Kinds.Types.BooleanType, raw: "boolean" });
                        }

                        fail();
                    }

                    case "&&":
                    case "||": {
                        if (isBoolean(leftType) && isBoolean(rightType)) {
                            return done({ kind: Kinds.Types.BooleanType, raw: "boolean" });
                        }

                        fail();
                    }

                    default: {
                        const message = `unknown binary operator ${Helpers.RED}'${node.operator}'${Helpers.RESET}`;
                        node.arrowLength = node.operator?.length ?? 1;
                        this.throwError(message, node.position, context.fullSource, node);
                    }
                }
            };

            return checkExpression(context.value);
        }
    };
}
