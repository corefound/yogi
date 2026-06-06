
export enum Kinds {
    Program = "Program",

    // --------------------------
    // Loops
    // --------------------------
    Block = "Block",
    WhileStatement = "WhileStatement",
    ForStatement = "ForStatement",
    ContinueStatement = "ContinueStatement",

    // --------------------------   
    // Conditional
    // --------------------------
    IfStatement = "IfStatement",
    SwitchStatement = "SwitchStatement",
    CaseClause = "CaseClause",
    DefaultClause = "DefaultClause",
    BreakStatement = "BreakStatement",

    // --------------------------
    // Dictionaries
    // --------------------------
    DictionaryExpression = "DictionaryExpression",

    // --------------------------
    // Arrays
    // --------------------------
    ArrayExpression = "ArrayExpression",
    ArrayDeclaration = "ArrayDeclaration",

    // --------------------------
    // Types
    // --------------------------
    UnTyped = "UnTyped",
    AnyType = "AnyType",
    NumberType = "NumberType",
    StringType = "StringType",
    BooleanType = "BooleanType",
    VoidType = "VoidType",
    TypeReference = "TypeReference",
    ArrayType = "ArrayType",
    UnionType = "UnionType",
    UnknownType = "UnknownType",
    OptionalType = "OptionalType",
    TypeLiteral = "TypeLiteral",
    PropertySignature = "PropertySignature",
    UnknownMember = "UnknownMember",
    IndexedAccessType = "IndexedAccessType",
    ConditionalType = "ConditionalType",
    InferType = "InferType",
    TypeQuery = "TypeQuery",
    TypeOperator = "TypeOperator",
    FunctionType = "FunctionType",
    IntersectionType = "IntersectionType",
    TupleType = "TupleType",
    LiteralType = "LiteralType",
    UndefinedType = "UndefinedType",
    NullType = "NullType",
    NeverType = "NeverType",

    // --------------------------
    // Externs
    // --------------------------
    ExternDeclarations = "ExternDeclarations",
    ExternMember = "ExternMember",
    ExternProperty = "ExternProperty",
    ExternMethod = "ExternMethod",

    // --------------------------
    // Exports and imports
    // --------------------------
    ImportDeclarations = "ImportDeclarations",
    ExportVariableStatement = "ExportVariableStatement",

    BinaryExpression = "BinaryExpression",

    DictionaryDeclaration = "DictionaryDeclaration",
    DictionaryProperty = "DictionaryProperty",

    BlockStatement = "BlockStatement",
    ExpressionBody = "ExpressionBody",

    // --------------------------
    // FunctionDeclaration
    // --------------------------
    FunctionDeclaration = "FunctionDeclaration",
    FunctionExpression = "FunctionExpression",
    FunctionParameter = "FunctionParameter",
    FunctionBody = "FunctionBody",
    FunctionCall = "FunctionCall",
    FunctionReturn = "FunctionReturn",


    // ----------------------------
    // Expressions
    // ----------------------------
    UnaryExpression = "UnaryExpression",
    ExpressionStatement = "ExpressionStatement",
    DeclarationStatement = "DeclarationStatement",
    VariableDeclaration = "VariableDeclaration",
    VariableReassignment = "VariableReassignment",
    AssignmentExpression = "AssignmentExpression",
    PropertyAccessExpression = "PropertyAccessExpression",
    CallExpression = "CallExpression",

    Identifier = "Identifier",
    UndefinedLiteral = "UndefinedLiteral",
    NaNLiteral = "NaNLiteral",
    InfinityLiteral = "InfinityLiteral",

    NumberLiteral = "NumberLiteral",
    BooleanLiteral = "BooleanLiteral",
    StringLiteral = "StringLiteral",
    NullLiteral = "NullLiteral",
    ImportCall = "ImportCall",
    ExportCall = "ExportCall",
    ExportVariable = "ExportVariable",

    ReturnStatement = "ReturnStatement",
    Unknown = "Unknown",
}





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
}
