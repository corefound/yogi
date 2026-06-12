import type { LinkKind } from "../fbs";

export type GlobalMetaModuleInput = {
    isEntry: boolean;
    rootPath: string;
    name: string;
    shouldLower: boolean;

    sourcePath: string;
    astPath: string;
    objectPath: string;
    sirPath: string;

    sourceHash: string;
    astHash: string;
    sirHash: string;
};

export type GlobalMetaInput = {
    rootPath: string;
    outputPath: string;
    cachePath: string;
    modules: GlobalMetaModuleInput[];
    links: GlobalMetaLinkInput[];
};

export type GlobalMetaLinkInput = {
    kind: LinkKind;
    path: string;
};

export type SourcePosition = {
    line: number;
    character: number;
};

export type SemanticType = {
    kind: string;
    raw: string;
    [key: string]: any;
};

export type SemanticNumberConstant = {
    kind: "NumberConstant";
    type: SemanticType;
    raw: string;
    value: number;
    source: string;
    position: SourcePosition;
};

export type SemanticStringConstant = {
    kind: "StringConstant";
    type: SemanticType;
    raw: string;
    value: string;
    source: string;
    position: SourcePosition;
};

export type SemanticBooleanConstant = {
    kind: "BooleanConstant";
    type: SemanticType;
    raw: string;
    value: boolean;
    source: string;
    position: SourcePosition;
};

export type SemanticNullConstant = {
    kind: "NullConstant";
    type: SemanticType;
    raw: string;
    value?: null;
    source: string;
    position: SourcePosition;
};

export type SemanticUndefinedConstant = {
    kind: "UndefinedConstant";
    type: SemanticType;
    raw: string;
    value?: "undefined";
    source: string;
    position: SourcePosition;
};

export type SemanticConstantInput =
    | SemanticNumberConstant
    | SemanticStringConstant
    | SemanticBooleanConstant
    | SemanticNullConstant
    | SemanticUndefinedConstant;

export type SemanticIdentifierExpression = {
    kind: "IdentifierExpression";
    name?: string;
    value?: string;
    raw?: string;
    type: SemanticType;
    symbolId?: number;
    scopeId?: number;
    source?: string;
    position?: SourcePosition;
};

export type SemanticBinaryExpression = {
    kind: "BinaryExpression";
    operator: string;
    left: SemanticValueInput;
    right: SemanticValueInput;
    type: SemanticType;
    source?: string;
    position?: SourcePosition;
};

export type SemanticAssignmentExpression = {
    kind: "AssignmentExpression";
    left: SemanticIdentifierExpression;
    right: SemanticValueInput;
    type: SemanticType;
    source?: string;
    position?: SourcePosition;
};

export type SemanticValueInput =
    | SemanticConstantInput
    | SemanticIdentifierExpression
    | SemanticBinaryExpression
    | SemanticAssignmentExpression;

export type SemanticVariableDeclaration = {
    kind: "VariableDeclaration";
    name: string;
    type: SemanticType;
    value: SemanticValueInput | null;
    symbolId?: number;
    scopeId?: number;
    mutable?: boolean;
    storage?: string | null;
    flag?: string;
    export?: boolean;
    trusted?: boolean;
    linkageName?: string | null;
    qualifiedName?: string;
    source?: string;
    position?: SourcePosition;
};

export type SemanticReturnStatement = {
    kind: "ReturnStatement";
    value: SemanticValueInput | null;
    source?: string;
    position?: SourcePosition;
};

export type SemanticBlockStatement = {
    kind: "BlockStatement";
    statements: SemanticNodeInput[];
    source?: string;
    position?: SourcePosition;
};

export type SemanticIfStatement = {
    kind: "IfStatement";
    condition: SemanticValueInput;
    then: SemanticBlockStatement;
    else?: SemanticBlockStatement | null;
    source?: string;
    position?: SourcePosition;
};

export type SemanticFunctionParameter = {
    kind: "FunctionParameter";
    name: string;
    type: SemanticType;
    symbolId?: number;
    scopeId?: number;
    mutable?: boolean;
    storage?: string | null;
    trusted?: boolean;
    source?: string;
    position?: SourcePosition;
};

export type SemanticFunctionDeclaration = {
    kind: "FunctionDeclaration";
    name: string;
    params: SemanticFunctionParameter[];
    returnType: SemanticType;
    body: SemanticBlockStatement;
    symbolId?: number;
    scopeId?: number;
    mutable?: boolean;
    flag?: string | { name?: string };
    export?: boolean;
    trusted?: boolean;
    linkageName?: string | null;
    qualifiedName?: string;
    source?: string;
    position?: SourcePosition;
};

export type SemanticExternParameter = {
    kind: "ExternParameter";
    name: string;
    type: SemanticType;
    optional: boolean;
    rest: boolean;
    position: SourcePosition;
};

export type SemanticExternFunction = {
    kind: "ExternFunction";
    name: string;
    parameters: SemanticExternParameter[];
    returnType: SemanticType;
    optional: boolean;
    source: string;
    position: SourcePosition;
};

export type SemanticExternVariable = {
    kind: "ExternVariable";
    name: string;
    type: SemanticType;
    readonly: boolean;
    source: string;
    position: SourcePosition;
};

export type SemanticExternDeclaration = {
    kind: "ExternDeclaration";
    name: string;
    path: string;
    functions: SemanticExternFunction[];
    variables: SemanticExternVariable[];
    source: string;
    position: SourcePosition;
};

export type SemanticNodeInput =
    | SemanticConstantInput
    | SemanticIdentifierExpression
    | SemanticBinaryExpression
    | SemanticAssignmentExpression
    | SemanticVariableDeclaration
    | SemanticReturnStatement
    | SemanticBlockStatement
    | SemanticIfStatement
    | SemanticFunctionDeclaration
    | SemanticExternDeclaration;

export type SemanticModuleInput = {
    sourcePath: string;
    nodes: SemanticNodeInput[];
};
