

export enum Nodes {
    CallExpression = "CallExpression",
    NumberLiteral = "NumberLiteral",
    Identifier = "Identifier",
    BooleanLiteral = "BooleanLiteral",
    StringLiteral = "StringLiteral",
    BinaryExpression = "BinaryExpression",
    NullLiteral = "NullLiteral",
    ImportCall = "ImportCall",
    ExportCall = "ExportCall",
    ExportVariable = "ExportVariable",
    ExportVariableStatement = "ExportVariableStatement",
}


export enum Kinds {
    ExportVariableStatement = "ExportVariableStatement",

    BinaryExpression = "BinaryExpression",

    DictionaryDeclaration = "DictionaryDeclaration",
    DictionaryProperty = "DictionaryProperty",

    DeclarationStatement = "DeclarationStatement",
    VariableDeclaration = "VariableDeclaration",
    VariableReassignment = "VariableReassignment",
    AssignmentExpression = "AssignmentExpression",

    Identifier = "Identifier",
    UndefinedLiteral = "UndefinedLiteral",
    NaNLiteral = "NaNLiteral",
    InfinityLiteral = "InfinityLiteral",
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
