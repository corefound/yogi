import { z } from "zod";
import { Kinds } from "../helpers/types";

export namespace Nodes {
    export type Expression = Literals | BinaryExpression;


    export type Diagnostics = {
        kind: Kinds.Diagnostics;
        message: string;
        position: Position;
        source: string;
        fileName: string;
    }

    export type Position = {
        line: number;
        character: number;
    }

    export type Literals = {
        kind: Kinds.Literals;
        value: string;
        source: string;
        position: Position;
    }

    export type BinaryExpression = {
        kind: Kinds.Expressions.BinaryExpression;
        left: Expression;
        operator: string;
        right: Expression;
        source: string;
        position: Position;
    };

    export type UnaryExpression = {
        kind: Kinds.Expressions.UnaryExpression;
        prefix: Boolean;
        operand: Expression;
        operator: string;
        source: string;
        position: Position;
    };
}
