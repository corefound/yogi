import { LinkKind } from "../fbs";

export namespace Types {
    export namespace Sir {
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

        export type SemanticType =
            | {
                kind: "NumberType";
                raw: string;
            }
            | {
                kind: "StringType";
                raw: string;
            }
            | {
                kind: "BooleanType";
                raw: string;
            }
            | {
                kind: "NullType";
                raw: string;
            }
            | {
                kind: "UndefinedType";
                raw: string;
            }
            | {
                kind: "VoidType";
                raw: string;
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
            source: string;
            position: SourcePosition;
        };

        export type SemanticUndefinedConstant = {
            kind: "UndefinedConstant";
            type: SemanticType;
            raw: string;
            source: string;
            position: SourcePosition;
        };

        export type SemanticConstantInput = SemanticNumberConstant
            | SemanticStringConstant
            | SemanticBooleanConstant
            | SemanticNullConstant
            | SemanticUndefinedConstant;

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

        export type SemanticNodeInput = SemanticConstantInput | SemanticExternDeclaration;

        export type SemanticModuleInput = {
            sourcePath: string;
            nodes: SemanticNodeInput[];
        };

    }

    export type AstNumberLiteralInput = {
        kind: "number";
        value: number;
        raw: string;
    };

    export type AstStringLiteralInput = {
        kind: "string";
        value: string;
        raw: string;
    };

    export type AstBooleanLiteralInput = {
        kind: "boolean";
        value: boolean;
        raw: string;
    };

    export type AstNullLiteralInput = {
        kind: "null";
        raw: string;
    };

    export type AstUndefinedLiteralInput = {
        kind: "undefined";
        raw: string;
    };

    export type AstLiteralInput =
        | AstNumberLiteralInput
        | AstStringLiteralInput
        | AstBooleanLiteralInput
        | AstNullLiteralInput
        | AstUndefinedLiteralInput;
    export type GlobalMetaModuleInput = {
        name: string;
        sourcePath: string;
        sourceHash: string;
        astHash: string;
        sirHash: string;
        shouldLower: boolean;
        isEntry: boolean;
    };

    export type GlobalMetaLinkInput = {
        kind: LinkKind;
        path: string;
    };

    export type GlobalMetaInput = {
        rootPath: string;
        cachePath: string;
        outputPath: string;
        modules: GlobalMetaModuleInput[];
        links: GlobalMetaLinkInput[];
    };

    export type Ast = {
        module?: any;
        body: any[];
    }

    export type DeclarationContext = {
        flag: "const" | "let";
        export: boolean;
        source: string;
        type: {
            kind: Kinds.Types;
            raw: any;
        };
        position: any;
    };

    export type Sir = {

    }

    export type ExportedSymbols = {
        kind: any;
        node: any;
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
        linkageName?: string;
        qualifiedName: string;
        kind: Kinds.ScopeSymbols;
        type: any;
        mutable: boolean;
        scopeId: number;
        escapes?: boolean;
        storage?: Kinds.Storage;
        trusted?: boolean;
        declare?: boolean;
        ambient?: boolean;
        emit?: boolean;
        node: any;
    };
}


export namespace Kinds {
    export enum Root {
        Program = "Program",
    }

    export enum ErrrorsMessage {
        MissingType = "Missing explicit type annotation",
        SyntaxError = "Invalid symbolic expression",
        TypeError = "Type error",
        ReferenceError = "Reference error",
        InternalError = "Internal error",
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
        DeclarationFlag = "DeclarationFlag",
        BlockStatement = "BlockStatement",
        ExpressionStatement = "ExpressionStatement",
        DeclarationStatement = "DeclarationStatement",
        ReturnStatement = "ReturnStatement",
        ExportVariableStatement = "ExportVariableStatement",
        ArrayDeclaration = "ArrayDeclaration",

        IfStatement = "IfStatement",
        SwitchStatement = "SwitchStatement",
        WhileStatement = "WhileStatement",
        ForStatement = "ForStatement",
        BreakStatement = "BreakStatement",
        ContinueStatement = "ContinueStatement",

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
        ParenthesizedExpression = "ParenthesizedExpression",

        IdentifierExpression = "IdentifierExpression",
        BodyExpression = "BodyExpression",
    }

    export enum Literals {
        BigIntLiteral = "BigIntLiteral",
        NumberLiteral = "NumberLiteral",

        StringLiteral = "StringLiteral",
        TemplateStringLiteral = "TemplateStringLiteral",

        BooleanLiteral = "BooleanLiteral",

        NullLiteral = "NullLiteral",
        UndefinedLiteral = "UndefinedLiteral",

        NaNLiteral = "NaNLiteral",
        InfinityLiteral = "InfinityLiteral",

        RegularExpressionLiteral = "RegularExpressionLiteral",
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
        TypeUsage = "TypeUsage",
        QualifiedName = "TypeUsage",
        Parameter = "Parameter",
        CallSignature = "CallSignature",
        ConstructSignature = "ConstructSignature",
        IndexSignature = "IndexSignature",
        PropertyName = "PropertyName",
        UnknownBindingName = "UnknownBindingName",


        UnTyped = "UnTyped",

        TypeDeclaration = "TypeDeclaration",
        InterfaceDeclaration = "InterfaceDeclaration",
        TypeMember = "TypeMember",
        TypeParameter = "TypeParameter",

        ExpressionWithTypeArguments = "ExpressionWithTypeArguments",
        UnknownExpression = "UnknownExpression",

        MethodSignature = "MethodSignature",

        RegExpType = "RegExpType",
        BigIntType = "BigIntType",

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
        Type = "type",
        Interface = "interface",
        Class = "class",

    }

    export enum Diagnostics {
        Error = "Error",
        Warning = "Warning",
    }

    export enum Storage {
        stack = "stack",
        heap = "heap",
        global = "global",
        local = "local",
    }

    export enum Miscellaneous {
        Unknown = "Unknown",
        ExportedSymbols = "ExportedSymbols",
    }

    export enum Sir {
        NumberConstant = "NumberConstant",
        StringConstant = "StringConstant",
        BooleanConstant = "BooleanConstant",
        NullConstant = "NullConstant",
        UndefinedConstant = "UndefinedConstant",
        NaNConstant = "NaNConstant",
        InfinityConstant = "InfinityConstant",
        BigIntConstant = "BigIntConstant",
        RegExpConstant = "RegExpConstant",
        TemplateStringConstant = "TemplateStringConstant",
        ExternDeclaration = "ExternDeclaration",
        ExternFunction = "ExternFunction",
        ExternParameter = "ExternParameter",
        ExternVariable = "ExternVariable",
    }
}
