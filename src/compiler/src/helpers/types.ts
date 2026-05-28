export enum Types {
    Any = "any",
}


export enum Kinds {
    ExportVariableStatement = "ExportVariableStatement",

    BinaryExpression = "BinaryExpression",

    DictionaryDeclaration = "DictionaryDeclaration",
    DictionaryProperty = "DictionaryProperty",

    // --------------------------
    // FunctionDeclaration
    // --------------------------
    FunctionDeclaration = "FunctionDeclaration",
    FunctionExpression = "FunctionExpression",

    // ----------------------------
    // Expressions
    // ----------------------------
    ExpressionStatement = "ExpressionStatement",
    DeclarationStatement = "DeclarationStatement",
    VariableDeclaration = "VariableDeclaration",
    VariableReassignment = "VariableReassignment",
    AssignmentExpression = "AssignmentExpression",

    Identifier = "Identifier",
    UndefinedLiteral = "UndefinedLiteral",
    NaNLiteral = "NaNLiteral",
    InfinityLiteral = "InfinityLiteral",

    CallExpression = "CallExpression",
    NumberLiteral = "NumberLiteral",
    BooleanLiteral = "BooleanLiteral",
    StringLiteral = "StringLiteral",
    NullLiteral = "NullLiteral",
    ImportCall = "ImportCall",
    ExportCall = "ExportCall",
    ExportVariable = "ExportVariable"
}


export type Module = {
    module: string;
    body: any[];
}

export type Program = {
    entry: string;
    dag: string[]
    graph: Map<string, string[]>;
    modules: Module[];
};
