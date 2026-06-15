import type * as CompilerTypes from "./compiler";
import type * as SirTypes from "./sir";

export { Kinds } from "./kinds";

export namespace Types {
    export namespace Sir {
        export type GlobalMetaModuleInput = SirTypes.GlobalMetaModuleInput;
        export type GlobalMetaInput = SirTypes.GlobalMetaInput;
        export type GlobalMetaLinkInput = SirTypes.GlobalMetaLinkInput;
        export type SourcePosition = SirTypes.SourcePosition;
        export type SemanticType = SirTypes.SemanticType;
        export type SemanticNumberConstant = SirTypes.SemanticNumberConstant;
        export type SemanticStringConstant = SirTypes.SemanticStringConstant;
        export type SemanticBooleanConstant = SirTypes.SemanticBooleanConstant;
        export type SemanticNullConstant = SirTypes.SemanticNullConstant;
        export type SemanticUndefinedConstant = SirTypes.SemanticUndefinedConstant;
        export type SemanticConstantInput = SirTypes.SemanticConstantInput;
        export type SemanticIdentifierExpression = SirTypes.SemanticIdentifierExpression;
        export type SemanticBinaryExpression = SirTypes.SemanticBinaryExpression;
        export type SemanticAssignmentExpression = SirTypes.SemanticAssignmentExpression;
        export type SemanticConditionalExpression = SirTypes.SemanticConditionalExpression;
        export type SemanticCallExpression = SirTypes.SemanticCallExpression;
        export type SemanticCallArgumentEffect = SirTypes.SemanticCallArgumentEffect;
        export type SemanticArrayExpression = SirTypes.SemanticArrayExpression;
        export type SemanticObjectProperty = SirTypes.SemanticObjectProperty;
        export type SemanticObjectExpression = SirTypes.SemanticObjectExpression;
        export type SemanticPropertyAccessExpression = SirTypes.SemanticPropertyAccessExpression;
        export type SemanticElementAccessExpression = SirTypes.SemanticElementAccessExpression;
        export type SemanticAggregateAssignmentExpression = SirTypes.SemanticAggregateAssignmentExpression;
        export type SemanticValueInput = SirTypes.SemanticValueInput;
        export type SemanticVariableDeclaration = SirTypes.SemanticVariableDeclaration;
        export type SemanticReturnStatement = SirTypes.SemanticReturnStatement;
        export type SemanticBlockStatement = SirTypes.SemanticBlockStatement;
        export type SemanticIfStatement = SirTypes.SemanticIfStatement;
        export type SemanticFunctionParameter = SirTypes.SemanticFunctionParameter;
        export type SemanticParameterEffect = SirTypes.SemanticParameterEffect;
        export type SemanticFunctionEffectSummary = SirTypes.SemanticFunctionEffectSummary;
        export type SemanticFunctionDeclaration = SirTypes.SemanticFunctionDeclaration;
        export type SemanticExternParameter = SirTypes.SemanticExternParameter;
        export type SemanticExternFunction = SirTypes.SemanticExternFunction;
        export type SemanticExternVariable = SirTypes.SemanticExternVariable;
        export type SemanticExternDeclaration = SirTypes.SemanticExternDeclaration;
        export type SemanticNodeInput = SirTypes.SemanticNodeInput;
        export type SemanticModuleInput = SirTypes.SemanticModuleInput;
    }

    export type AstNumberLiteralInput = CompilerTypes.AstNumberLiteralInput;
    export type AstStringLiteralInput = CompilerTypes.AstStringLiteralInput;
    export type AstBooleanLiteralInput = CompilerTypes.AstBooleanLiteralInput;
    export type AstNullLiteralInput = CompilerTypes.AstNullLiteralInput;
    export type AstUndefinedLiteralInput = CompilerTypes.AstUndefinedLiteralInput;
    export type AstLiteralInput = CompilerTypes.AstLiteralInput;
    export type GlobalMetaModuleInput = CompilerTypes.GlobalMetaModuleInput;
    export type GlobalMetaLinkInput = CompilerTypes.GlobalMetaLinkInput;
    export type GlobalMetaInput = CompilerTypes.GlobalMetaInput;
    export type Ast = CompilerTypes.Ast;
    export type DeclarationContext = CompilerTypes.DeclarationContext;
    export type Sir = CompilerTypes.Sir;
    export type ExportedSymbols = CompilerTypes.ExportedSymbols;
    export type Program = CompilerTypes.Program;
    export type Diagnostics = CompilerTypes.Diagnostics;
    export type SymbolInfo = CompilerTypes.SymbolInfo;
    export type SemanticModuleSymbol = CompilerTypes.SemanticModuleSymbol;
    export type SemanticModuleInfo = CompilerTypes.SemanticModuleInfo;
}
