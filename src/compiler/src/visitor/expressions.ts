import ts from "../ts";
import { BaseVisitor, Constructor } from "../visitor/base";
import { Kinds } from "../helpers/types";
import { Nodes } from "../nodes";

export function ExpressionVisitor<TBase extends Constructor<BaseVisitor>>(
	Base: TBase,
) {
	return class extends Base {
		visitExpressions(node: ts.Node) {
			if (ts.isParenthesizedExpression(node))
				return this.visitParenthesizedExpression(node);

			if (ts.isAsExpression(node)) return this.visitCastExpression(node);

			if (ts.isTypeAssertionExpression(node))
				return this.visitTypeAssertionExpression(node);

			if (ts.isNonNullExpression(node))
				return this.visitNonNullExpression(node);

			if (ts.isSatisfiesExpression(node))
				return this.visitSatisfiesExpression(node);

			if (ts.isConditionalExpression(node))
				return this.visitConditionalExpression(node);

			if (ts.isCallExpression(node)) return this.visitCallExpression(node);

			if (ts.isBinaryExpression(node)) return this.visitBinaryExpression(node);

			if (ts.isPrefixUnaryExpression(node))
				return this.visitPrefixUnaryExpression(node);

			if (ts.isPostfixUnaryExpression(node))
				return this.visitPostfixUnaryExpression(node);

			if (ts.isExpressionStatement(node)) return this.visitExpression(node);

			if (ts.isPropertyAccessExpression(node))
				return this.visitPropertyAccessExpression(node);

			if (ts.isElementAccessExpression(node))
				return this.visitElementAccessExpression(node);
		}

		visitExpression(node: ts.ExpressionStatement) {
			return this.visitNode(node.expression);
		}

		visitParenthesizedExpression(node: ts.ParenthesizedExpression) {
			return {
				kind: Kinds.Expressions.ParenthesizedExpression,
				expression: this.visitNode(node.expression),
				source: node.getText(),
				fullSource: node.getFullText(),
				position: this.getNodePosistion(node),
			};
		}

		visitCastExpression(node: ts.AsExpression) {
			return {
				kind: Kinds.Expressions.CastExpression,
				expression: this.visitNode(node.expression),
				type: this.visitType(node.type),
				source: node.getText(),
				fullSource: node.getFullText(),
				position: this.getNodePosistion(node),
			};
		}

		visitTypeAssertionExpression(node: ts.TypeAssertion) {
			return {
				kind: Kinds.Expressions.CastExpression,
				expression: this.visitNode(node.expression),
				type: this.visitType(node.type),
				source: node.getText(),
				fullSource: node.getFullText(),
				position: this.getNodePosistion(node),
			};
		}

		visitNonNullExpression(node: ts.NonNullExpression) {
			return {
				kind: Kinds.Expressions.NonNullExpression,
				expression: this.visitNode(node.expression),
				source: node.getText(),
				fullSource: node.getFullText(),
				position: this.getNodePosistion(node),
			};
		}

		visitSatisfiesExpression(node: ts.SatisfiesExpression) {
			return {
				kind: Kinds.Expressions.SatisfiesExpression,
				expression: this.visitNode(node.expression),
				type: this.visitType(node.type),
				source: node.getText(),
				fullSource: node.getFullText(),
				position: this.getNodePosistion(node),
			};
		}

		visitConditionalExpression(node: ts.ConditionalExpression) {
			return {
				kind: Kinds.Expressions.ConditionalExpression,
				condition: this.visitNode(node.condition),
				whenTrue: this.visitNode(node.whenTrue),
				whenFalse: this.visitNode(node.whenFalse),
				source: node.getText(),
				fullSource: node.getFullText(),
				position: this.getNodePosistion(node),
			};
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
				optional: (node as any).questionDotToken !== undefined,
				source: node.getText(),
				position: this.getNodePosistion(node),
			};
		}

		visitElementAccessExpression(node: ts.ElementAccessExpression) {
			return {
				kind: Kinds.Expressions.ElementAccessExpression,
				object: this.visitNode(node.expression),
				index: this.visitNode(node.argumentExpression),
				optional: (node as any).questionDotToken !== undefined,
				source: node.getText(),
				position: this.getNodePosistion(node),
			};
		}
	};
}
