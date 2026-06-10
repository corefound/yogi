import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";
import { Nodes } from "../nodes";

export function ExpressionVisitor<TBase extends Constructor<BaseVisitor>>(
  Base: TBase,
) {
  return class extends Base {
    visitExpressions(node: ts.Node) {
      if (ts.isCallExpression(node)) return this.visitCallExpression(node);
      if (ts.isBinaryExpression(node)) return this.visitBinaryExpression(node);
      if (ts.isPrefixUnaryExpression(node))
        return this.visitPrefixUnaryExpression(node);
      if (ts.isPostfixUnaryExpression(node))
        return this.visitPostfixUnaryExpression(node);
      if (ts.isExpressionStatement(node)) return this.visitExpression(node);
      if (ts.isPropertyAccessExpression(node))
        return this.visitPropertyAccessExpression(node);
    }

    visitExpression(node: ts.ExpressionStatement) {
      return this.visitNode(node.expression);
    }

    visitBinaryExpression(node: ts.BinaryExpression) {
      return {
        kind: Kinds.Expressions.BinaryExpression,
        left: this.visitNode(node.left),
        operator: node.operatorToken.getText(),
        right: this.visitNode(node.right),
        source: node.getText(),
        fullSource: node.getFullText(),
        position: this.getNodePosistion(node),
      };
    }

    visitPrefixUnaryExpression(node: ts.PrefixUnaryExpression) {
      return {
        kind: Kinds.Expressions.UnaryExpression,
        prefix: true,
        operator: ts.tokenToString(node.operator) ?? node.getText()[0],
        operand: this.visitNode(node.operand),
        source: node.getText(),
        position: this.getNodePosistion(node),
      };
    }

    visitPostfixUnaryExpression(node: ts.PostfixUnaryExpression) {
      return {
        kind: Kinds.Expressions.UnaryExpression,
        operator: ts.tokenToString(node.operator) ?? node.getText().slice(-2),
        prefix: false,
        operand: this.visitNode(node.operand),
        source: node.getText(),
        position: this.getNodePosistion(node),
      };
    }

    visitCallExpression(node: ts.CallExpression) {
      return {
        kind: Kinds.Expressions.CallExpression,
        callee: this.visitNode(node.expression),
        arguments: node.arguments.map((arg) => this.visitNode(arg)),
        source: node.getText(),
        position: this.getNodePosistion(node),
      };
    }

    visitPropertyAccessExpression(node: ts.PropertyAccessExpression) {
      return {
        kind: Kinds.Expressions.PropertyAccessExpression,
        object: this.visitNode(node.expression),
        property: node.name.getText(),
        source: node.getText(),
        position: this.getNodePosistion(node),
      };
    }
  };
}
