export namespace Types {
    export type Ast = {
        module: string;
        body: any[];
    }

    export type Program = {
        entry: string;
        dag: string[]
        graph: Map<string, string[]>;
        ast: Ast[];
    };

    export type Diagnostics = {
        kind: Kinds.Diagnostics;
        message: string;
        position: {
            line: number;
            character: number;
        };
        source: string;
        fileName: string;
    }

    export type SymbolInfo = {
        id: number;
        name: string;
        kind: Kinds.ScopeSymbols;
        type: any;
        mutable: boolean;
        scopeId: number;
        escapes: boolean;
        storage: Kinds.Storage;
    };
}


export namespace Kinds {
    export enum Root {
        Program = "Program",
    }

    export enum Operators {
        Add = "+",
        Subtract = "-",
        Multiply = "*",
        Divide = "/",
        Modulo = "%",
        Exponent = "**",
        Equals = "==",
        NotEquals = "!=",
        LessThan = "<",
        LessThanOrEqual = "<=",
        GreaterThan = ">",
        GreaterThanOrEqual = ">=",
        LogicalAnd = "&&",
        LogicalOr = "||",
        LogicalNot = "!",
        BitwiseAnd = "&",
        BitwiseOr = "|",
        BitwiseXor = "^",
        BitwiseNot = "~",
        LeftShift = "<<",
        RightShift = ">>",
        RightShiftUnsigned = ">>>",
    }

    export enum Statements {
        BlockStatement = "BlockStatement",
        ExpressionStatement = "ExpressionStatement",
        DeclarationStatement = "DeclarationStatement",
        ReturnStatement = "ReturnStatement",
        ExportVariableStatement = "ExportVariableStatement",

        VariableDeclaration = "VariableDeclaration",
        VariableReassignment = "VariableReassignment",
    }

    export enum Functions {
        FunctionDeclaration = "FunctionDeclaration",
        FunctionExpression = "FunctionExpression",
        FunctionParameter = "FunctionParameter",
        FunctionBody = "FunctionBody",
        FunctionCall = "FunctionCall",
        FunctionReturn = "FunctionReturn",
    }

    export enum Expressions {
        UnaryExpression = "UnaryExpression",
        BinaryExpression = "BinaryExpression",
        AssignmentExpression = "AssignmentExpression",
        PropertyAccessExpression = "PropertyAccessExpression",
        CallExpression = "CallExpression",

        IdentifierExpression = "IdentifierExpression",
        BodyExpression = "BodyExpression",
    }

    export enum Literals {
        NumberLiteral = "NumberLiteral",
        StringLiteral = "StringLiteral",
        BooleanLiteral = "BooleanLiteral",

        NullLiteral = "NullLiteral",
        UndefinedLiteral = "UndefinedLiteral",

        NaNLiteral = "NaNLiteral",
        InfinityLiteral = "InfinityLiteral",
    }

    export enum Collections {
        DictionaryExpression = "DictionaryExpression",
        DictionaryDeclaration = "DictionaryDeclaration",
        DictionaryProperty = "DictionaryProperty",

        ArrayExpression = "ArrayExpression",
        ArrayDeclaration = "ArrayDeclaration",
    }

    export enum ControlFlow {
        IfStatement = "IfStatement",

        SwitchStatement = "SwitchStatement",
        CaseClause = "CaseClause",
        DefaultClause = "DefaultClause",

        WhileStatement = "WhileStatement",
        ForStatement = "ForStatement",

        BreakStatement = "BreakStatement",
        ContinueStatement = "ContinueStatement",
    }

    export enum Modules {
        ImportDeclarations = "ImportDeclarations",
        ImportCall = "ImportCall",

        ExportCall = "ExportCall",
        ExportVariable = "ExportVariable",
    }

    export enum Externs {
        ExternDeclarations = "ExternDeclarations",
        ExternMember = "ExternMember",
        ExternProperty = "ExternProperty",
        ExternMethod = "ExternMethod",
    }

    export enum Types {
        UnTyped = "UnTyped",

        AnyType = "AnyType",
        UnknownType = "UnknownType",
        NeverType = "NeverType",

        VoidType = "VoidType",

        NumberType = "NumberType",
        StringType = "StringType",
        BooleanType = "BooleanType",

        NullType = "NullType",
        UndefinedType = "UndefinedType",

        OptionalType = "OptionalType",

        TypeReference = "TypeReference",
        TypeLiteral = "TypeLiteral",
        PropertySignature = "PropertySignature",

        ArrayType = "ArrayType",
        TupleType = "TupleType",

        UnionType = "UnionType",
        IntersectionType = "IntersectionType",

        FunctionType = "FunctionType",

        LiteralType = "LiteralType",

        IndexedAccessType = "IndexedAccessType",
        ConditionalType = "ConditionalType",

        InferType = "InferType",
        TypeQuery = "TypeQuery",
        TypeOperator = "TypeOperator",

        UnknownMember = "UnknownMember",
    }

    export enum ScopeSymbols {
        Function = "function",
        Variable = "variable",
        Parameter = "parameter",
        Extern = "extern",
    }

    export enum Diagnostics {
        Error = "Error",
        Warning = "Warning",
    }

    export enum Storage {
        stack = "stack",
        heap = "heap",
    }

    export enum Miscellaneous {
        Unknown = "Unknown",
    }
}