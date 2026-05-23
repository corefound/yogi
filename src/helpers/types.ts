

export enum Nodes {
    CallExpression = "CallExpression",
    NumberLiteral = "NumberLiteral",
    IdentifierLiteral = "IdentifierLiteral",
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
    VariableDeclaration = "VariableDeclaration"
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
