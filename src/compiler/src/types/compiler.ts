import type { LinkKind } from "../fbs";
import type { Kinds } from "./kinds";
import type { SemanticFunctionEffectSummary } from "./sir";

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
};

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

export type Sir = {};

export type ExportedSymbols = {
    kind: any;
    node: any;
};

export type Program = {
    entry: string;
    dag: string[];
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
};

export type SymbolInfo = {
    id: number;
    name: string;
    linkageName?: string;
    qualifiedName: string;
    kind: Kinds.ScopeSymbols;
    type: any;
    declaredType?: any;
    mutable: boolean;
    scopeId: number;
    escapes?: boolean;
    storage?: Kinds.Storage;
    trusted?: boolean;
    effectSummary?: SemanticFunctionEffectSummary;
    aggregateOwnerSymbolId?: number;
    borrowedView?: boolean;
    borrowedViewReadonly?: boolean;
    borrowedViewSourceName?: string | null;
    borrowedViewGraphSourceNames?: string[];
    borrowedViewGraphAggregateSymbolIds?: number[];
    borrowedViewGraphEscaped?: boolean;
    borrowedViewOwnerPromoted?: boolean;
    borrowedViewOwnerPromotionReasons?: string[];
    pointerRootName?: string | null;
    pointerRootSymbolId?: number;
    pointerAccessPath?: string[];
    pointerPermission?: "mutable" | "readonly";
    nativeResourceDestructor?: string | null;
    nativeResourceFieldDestructors?: Record<string, string>;
    nativeResourceArrayElementFieldDestructors?: Record<string, string>;
    returnsNativeResourceFieldDestructors?: Record<string, string>;
    returnsNativeResourceArrayElementFieldDestructors?: Record<string, string>;
    dynamicArrayStorageMode?: "contiguous_fast_path" | "pointer_safe_chunked_mode";
    dynamicArrayStorageReasons?: string[];
    moved?: boolean;
    moveReason?: string;
    movePosition?: any;
    moveSource?: string;
    declare?: boolean;
    ambient?: boolean;
    emit?: boolean;
    node: any;
};

export type SemanticModuleSymbol = {
    name: string;
    kind: Kinds.ScopeSymbols;
    type: any;
    mutable: boolean;
    linkageName?: string | null;
    qualifiedName?: string;
    sourcePath: string;
    node?: any;
    effectSummary?: SemanticFunctionEffectSummary;
    returnsNativeResourceFieldDestructors?: Record<string, string>;
    returnsNativeResourceArrayElementFieldDestructors?: Record<string, string>;
};

export type SemanticModuleInfo = {
    absolutePath: string;
    relativePath: string;
    exports: Map<string, SemanticModuleSymbol>;
};
