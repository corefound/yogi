import { Helpers } from "../helpers";

export type SemanticDecisionKind =
    | "Copy"
    | "Move"
    | "Borrow"
    | "Escape"
    | "Storage"
    | "Materialize"
    | "Promote";

export type SemanticDecisionReason =
    | "TrivialValueCopy"
    | "ExplicitArrayCopy"
    | "CopyingArrayMethod"
    | "ResourceOwningInitialization"
    | "ResourceOwningAssignment"
    | "ReturnTransfersToCaller"
    | "ValueParameterConsumes"
    | "AddressOfBorrow"
    | "DerivedViewBorrow"
    | "KnownCalleeBorrow"
    | "UnknownExternalConservativeEscape"
    | "DeclaredValueEscapes"
    | "StackStorage"
    | "HeapStorage"
    | "GlobalStorage"
    | "BorrowedViewMaterialization"
    | "BorrowedViewOwnerPromotion"
    | "EscapeRequiresHeap";

export type SemanticValueIdentity = {
    valueId: string;
    originNodeId: string;
    symbolId: string;
    scopeId: string;
    typeId: string;
    source: string;
    position?: { line: number; character: number };
};

export type SemanticDecision = {
    decisionId: string;
    nodeId: string;
    valueId: string;
    typeId: string;
    kind: SemanticDecisionKind;
    reason: SemanticDecisionReason;
    context: string;
    relatedIds: string[];
    runtimeRequired: boolean;
    source: string;
    position?: { line: number; character: number };
};

export type SemanticObservability = {
    moduleId: string;
    values: SemanticValueIdentity[];
    decisions: SemanticDecision[];
};

const VALUE_KINDS = new Set([
    "NumberConstant",
    "StringConstant",
    "BooleanConstant",
    "NullConstant",
    "UndefinedConstant",
    "IdentifierExpression",
    "BinaryExpression",
    "AssignmentExpression",
    "ConditionalExpression",
    "CallExpression",
    "SpreadElement",
    "ArrayExpression",
    "DictionaryExpression",
    "PropertyAccessExpression",
    "ElementAccessExpression",
    "AddressOfExpression",
    "DereferenceExpression",
    "AggregateAssignmentExpression",
    "FunctionExpression",
]);

const COPYING_ARRAY_METHODS = new Set([
    "array.concat",
    "array.slice",
    "array.toSpliced",
    "array.toReversed",
    "array.toSorted",
    "array.flat",
    "array.with",
    "array.filter",
    "array.map",
    "array.flatMap",
]);

const OBSERVABILITY_KEYS = new Set([
    "nodeId",
    "valueId",
    "typeId",
    "observabilityDecisionIds",
]);

function normalizedModulePath(sourcePath: string): string {
    const normalized = Helpers.normalizePath(sourcePath || "<unknown>");
    return normalized.replace(/^\.\//, "");
}

export function createModuleId(sourcePath: string): string {
    return `module:${normalizedModulePath(sourcePath)}`;
}

function visitObjectGraph(value: any, visitor: (node: any) => void, visited = new WeakSet<object>()): void {
    if (!value || typeof value !== "object") {
        return;
    }

    if (visited.has(value)) {
        return;
    }
    visited.add(value);

    if (!Array.isArray(value)) {
        visitor(value);
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            visitObjectGraph(item, visitor, visited);
        }
        return;
    }

    for (const key of Object.keys(value).sort()) {
        if (OBSERVABILITY_KEYS.has(key)) {
            continue;
        }
        visitObjectGraph(value[key], visitor, visited);
    }
}

export function assignAstNodeIds(nodes: any[], sourcePath: string): string {
    const moduleId = createModuleId(sourcePath);
    let ordinal = 0;

    visitObjectGraph(nodes, (node) => {
        if (typeof node.kind !== "string") {
            return;
        }

        node.nodeId = `node:${normalizedModulePath(sourcePath)}:${String(++ordinal).padStart(6, "0")}`;
    });

    return moduleId;
}

function stableTypeValue(value: any, visited = new WeakSet<object>()): any {
    if (value === null || value === undefined || typeof value !== "object") {
        return value;
    }

    if (visited.has(value)) {
        return "<recursive>";
    }
    visited.add(value);

    if (Array.isArray(value)) {
        const result = value.map((item) => stableTypeValue(item, visited));
        visited.delete(value);
        return result;
    }

    const result: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) {
        if (
            OBSERVABILITY_KEYS.has(key) ||
            key === "source" ||
            key === "fullSource" ||
            key === "position" ||
            key === "arrowLength"
        ) {
            continue;
        }

        const child = value[key];
        if (typeof child === "function" || child === undefined) {
            continue;
        }
        result[key] = stableTypeValue(child, visited);
    }

    visited.delete(value);
    return result;
}

export function createTypeId(type: any): string {
    if (!type) {
        return "type:unknown";
    }

    const resolved = type.resolved ?? type;
    return `type:sha256:${Helpers.hash(JSON.stringify(stableTypeValue(resolved)))}`;
}

function qualifiedSymbolId(node: any, modulePath: string): string {
    if (typeof node?.qualifiedName === "string" && node.qualifiedName.length > 0) {
        return `symbol:${Helpers.normalizePath(node.qualifiedName)}`;
    }

    if (typeof node?.symbolId === "number" && node.symbolId >= 0) {
        return `symbol:${normalizedModulePath(modulePath)}:${node.symbolId}`;
    }

    return "";
}

function qualifiedScopeId(node: any, modulePath: string): string {
    return typeof node?.scopeId === "number" && node.scopeId >= 0
        ? `scope:${normalizedModulePath(modulePath)}:${node.scopeId}`
        : "";
}

function relatedOwnerId(node: any, modulePath: string): string {
    if (typeof node?.valueId === "string" && node.valueId.length > 0) {
        return node.valueId;
    }

    const symbolId = qualifiedSymbolId(node, modulePath);
    if (symbolId.length > 0) {
        return symbolId;
    }

    if (typeof node?.rootSymbolId === "number" && node.rootSymbolId >= 0) {
        return `symbol:${normalizedModulePath(modulePath)}:${node.rootSymbolId}`;
    }

    return "";
}

function moveReason(context: string): SemanticDecisionReason {
    if (context.includes("returned")) {
        return "ReturnTransfersToCaller";
    }
    if (context.includes("passed by value")) {
        return "ValueParameterConsumes";
    }
    if (context.includes("initialized into") || context.includes("stored in")) {
        return "ResourceOwningInitialization";
    }
    return "ResourceOwningAssignment";
}

function storageReason(storage: string): SemanticDecisionReason {
    if (storage === "global") {
        return "GlobalStorage";
    }
    if (storage === "heap") {
        return "HeapStorage";
    }
    return "StackStorage";
}

function hasOwnershipSemantics(type: any): boolean {
    const resolved = type?.resolved ?? type;
    return [
        "ArrayType",
        "TupleType",
        "TypeLiteral",
        "TypeReference",
        "PointerType",
        "StringType",
    ].includes(resolved?.kind);
}

function appendDecisionId(target: any, decisionId: string): void {
    if (!target || typeof target !== "object") {
        return;
    }

    const ids = Array.isArray(target.observabilityDecisionIds)
        ? target.observabilityDecisionIds
        : [];
    if (!ids.includes(decisionId)) {
        ids.push(decisionId);
    }
    target.observabilityDecisionIds = ids;
}

export function buildSemanticObservability(nodes: any[], sourcePath: string): SemanticObservability {
    const moduleId = createModuleId(sourcePath);
    const modulePath = normalizedModulePath(sourcePath);
    const values: SemanticValueIdentity[] = [];
    let semanticNodeOrdinal = 0;
    let valueOrdinal = 0;

    visitObjectGraph(nodes, (node) => {
        if (typeof node.kind !== "string") {
            return;
        }

        if (!node.nodeId) {
            node.nodeId = `node:${modulePath}:semantic:${String(++semanticNodeOrdinal).padStart(6, "0")}`;
        }

        if (!VALUE_KINDS.has(node.kind)) {
            return;
        }

        node.valueId = `value:${modulePath}:${String(++valueOrdinal).padStart(6, "0")}`;
        node.typeId = createTypeId(node.type);
        values.push({
            valueId: node.valueId,
            originNodeId: node.nodeId,
            symbolId: qualifiedSymbolId(node, modulePath),
            scopeId: qualifiedScopeId(node, modulePath),
            typeId: node.typeId,
            source: node.source ?? node.raw ?? "",
            position: node.position,
        });
    });

    const decisions: SemanticDecision[] = [];
    let decisionOrdinal = 0;
    const addDecision = (
        owner: any,
        target: any,
        kind: SemanticDecisionKind,
        reason: SemanticDecisionReason,
        context: string,
        relatedIds: string[] = [],
    ): void => {
        const value = target?.valueId ? target : owner?.valueId ? owner : null;
        const decisionId = `decision:${modulePath}:${String(++decisionOrdinal).padStart(6, "0")}`;
        const decision: SemanticDecision = {
            decisionId,
            nodeId: owner?.nodeId ?? value?.nodeId ?? "",
            valueId: value?.valueId ?? "",
            typeId: value?.typeId ?? createTypeId(owner?.type),
            kind,
            reason,
            context,
            relatedIds: relatedIds.filter((id) => typeof id === "string" && id.length > 0),
            runtimeRequired: !!value,
            source: owner?.source ?? owner?.fullSource ?? value?.source ?? "",
            position: owner?.position ?? value?.position,
        };

        decisions.push(decision);
        appendDecisionId(owner, decisionId);
        appendDecisionId(value, decisionId);
    };

    visitObjectGraph(nodes, (node) => {
        if (node.kind === "CallExpression" && node.builtinMethod === "move") {
            const context = node.ownershipReason ?? node.moveReason ?? "resource ownership transfer";
            addDecision(node, node, "Move", moveReason(context), context, [
                node.arguments?.[0]?.valueId,
            ]);
        }

        if (node.kind === "CallExpression" && node.builtinMethod === "array.copy") {
            addDecision(
                node,
                node,
                node.materializedBorrowedView === true ? "Materialize" : "Copy",
                node.materializedBorrowedView === true
                    ? "BorrowedViewMaterialization"
                    : "ExplicitArrayCopy",
                node.materializedBorrowedView === true
                    ? "borrowed array view materialized into owned storage"
                    : "array.copy creates independent owned storage",
            );
        } else if (node.kind === "CallExpression" && COPYING_ARRAY_METHODS.has(node.builtinMethod)) {
            addDecision(
                node,
                node,
                "Copy",
                "CopyingArrayMethod",
                `${node.builtinMethod} creates an independent array result`,
            );
        }

        if (node.kind === "AddressOfExpression") {
            addDecision(node, node, "Borrow", "AddressOfBorrow", "address-of creates a temporary borrow", [
                relatedOwnerId(node.target, modulePath),
            ]);
        } else if (node.borrowedView === true && node.valueId) {
            addDecision(node, node, "Borrow", "DerivedViewBorrow", "derived aggregate view borrows its source", [
                relatedOwnerId(node.object, modulePath) ||
                    relatedOwnerId(node, modulePath),
            ]);
        }

        if (node.materializedBorrowedView === true && node.builtinMethod !== "array.copy") {
            addDecision(
                node,
                node,
                "Materialize",
                "BorrowedViewMaterialization",
                "borrowed view escapes and is materialized",
            );
        }

        if (node.borrowedViewOwnerPromoted === true || node.borrowedViewGraphOwnerPromoted === true) {
            addDecision(
                node,
                node,
                "Promote",
                "BorrowedViewOwnerPromotion",
                "borrowed view owner is promoted to preserve its lifetime",
            );
        }

        if (
            (node.kind === "VariableDeclaration" || node.kind === "ArrayDeclaration") &&
            typeof node.storage === "string" &&
            node.storage.length > 0
        ) {
            const target = node.value ?? node.elements?.[0] ?? null;
            addDecision(
                node,
                target,
                "Storage",
                storageReason(node.storage),
                `declaration '${node.name}' uses ${node.storage} storage`,
                [qualifiedSymbolId(node, modulePath), qualifiedScopeId(node, modulePath)],
            );

            if (node.escapes === true) {
                addDecision(
                    node,
                    target,
                    "Escape",
                    "DeclaredValueEscapes",
                    `declaration '${node.name}' escapes its declaring scope`,
                    [qualifiedSymbolId(node, modulePath)],
                );

                if (node.storage === "heap") {
                    addDecision(
                        node,
                        target,
                        "Promote",
                        "EscapeRequiresHeap",
                        `declaration '${node.name}' requires extended storage`,
                        [qualifiedSymbolId(node, modulePath)],
                    );
                }
            }
        }

        if (
            node.kind === "VariableDeclaration" &&
            node.value?.kind === "IdentifierExpression" &&
            node.value?.type?.kind === "TypeReference"
        ) {
            addDecision(
                node,
                node.value,
                "Copy",
                "TrivialValueCopy",
                `copyable struct '${node.name}' is initialized by value`,
                [node.value.valueId],
            );
        }

        if (node.kind === "CallExpression" && Array.isArray(node.argumentEffects)) {
            node.argumentEffects.forEach((effect: any, index: number) => {
                const argument = node.arguments?.[index];
                if (!argument?.valueId) {
                    return;
                }

                if (effect.escapes === true) {
                    addDecision(
                        node,
                        argument,
                        "Escape",
                        node.external === true
                            ? "UnknownExternalConservativeEscape"
                            : "DeclaredValueEscapes",
                        node.external === true
                            ? "external call conservatively allows the aggregate argument to escape"
                            : "callee effect summary allows the aggregate argument to escape",
                        [node.valueId],
                    );
                } else if (
                    effect.consumes !== true &&
                    effect.mutates !== true &&
                    hasOwnershipSemantics(argument.type)
                ) {
                    addDecision(
                        node,
                        argument,
                        "Borrow",
                        "KnownCalleeBorrow",
                        "known callee borrows the argument for the duration of the call",
                        [node.valueId],
                    );
                }
            });
        }
    });

    return {
        moduleId,
        values,
        decisions,
    };
}
