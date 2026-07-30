import fs from "node:fs";
import path from "node:path";
import { SemanticDecision, SemanticObservability, SemanticValueIdentity } from "./identity";

let sequence = 0;

function enabled(): boolean {
    const strict = process.env.YOGI_TRACE_STRICT;
    return !!process.env.YOGI_TRACE_DIRECTORY &&
        !!process.env.YOGI_TRACE_SESSION &&
        (strict === "1" || strict === "true" || strict === "ON");
}

function categoryEnabled(category: string): boolean {
    const configured = process.env.YOGI_TRACE_CATEGORIES;
    if (!configured) {
        return true;
    }

    return configured
        .split(",")
        .map((value) => value.trim())
        .includes(category);
}

function source(position: any, sourcePath: string) {
    return {
        path: sourcePath || "<unknown>",
        line: typeof position?.line === "number" ? position.line + 1 : 0,
        column: typeof position?.character === "number" ? position.character + 1 : 0,
    };
}

function emit(
    file: string,
    phase: string,
    category: string,
    eventKind: string,
    entityId: string,
    moduleId: string,
    sourcePath: string,
    position: any,
    details: Record<string, any>,
): void {
    if (!categoryEnabled(category)) {
        return;
    }

    const current = ++sequence;
    const event = {
        schemaVersion: 1,
        sessionId: process.env.YOGI_TRACE_SESSION,
        eventId: `event:frontend:${process.pid}:${current}`,
        sequence: current,
        phase,
        category,
        eventKind,
        producer: `frontend:${process.pid}`,
        processId: process.pid,
        processRole: "frontend-compiler",
        entityId,
        moduleId,
        source: source(position, sourcePath),
        details,
    };

    fs.appendFileSync(file, `${JSON.stringify(event)}\n`, "utf8");
}

function collectAstNodes(nodes: any[]): any[] {
    const result: any[] = [];
    const visited = new WeakSet<object>();

    const visit = (value: any): void => {
        if (!value || typeof value !== "object" || visited.has(value)) {
            return;
        }
        visited.add(value);

        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }

        if (typeof value.nodeId === "string" && typeof value.kind === "string") {
            result.push(value);
        }

        Object.keys(value).sort().forEach((key) => {
            if (
                key !== "nodeId" &&
                key !== "valueId" &&
                key !== "typeId" &&
                key !== "observabilityDecisionIds"
            ) {
                visit(value[key]);
            }
        });
    };

    visit(nodes);
    return result;
}

function emitValue(
    file: string,
    moduleId: string,
    sourcePath: string,
    value: SemanticValueIdentity,
): void {
    emit(
        file,
        "sir",
        "semantic",
        "sir.value.identity",
        value.valueId,
        moduleId,
        sourcePath,
        value.position,
        {
            valueId: value.valueId,
            nodeId: value.originNodeId,
            symbolId: value.symbolId,
            scopeId: value.scopeId,
            typeId: value.typeId,
        },
    );
}

function emitDecision(
    file: string,
    moduleId: string,
    sourcePath: string,
    decision: SemanticDecision,
): void {
    emit(
        file,
        "frontend",
        "semantic",
        "semantic.decision.plan",
        decision.decisionId,
        moduleId,
        sourcePath,
        decision.position,
        {
            decisionId: decision.decisionId,
            nodeId: decision.nodeId,
            valueId: decision.valueId,
            typeId: decision.typeId,
            decisionKind: decision.kind,
            decisionReason: decision.reason,
            context: decision.context,
            relatedIds: decision.relatedIds,
            runtimeRequired: decision.runtimeRequired,
        },
    );
}

export function emitFrontendObservability(
    sourcePath: string,
    ast: any[],
    observability: SemanticObservability,
): void {
    if (!enabled()) {
        return;
    }

    const traceDirectory = process.env.YOGI_TRACE_DIRECTORY!;
    fs.mkdirSync(traceDirectory, { recursive: true });
    const file = path.join(traceDirectory, `frontend-${process.pid}.events.jsonl`);

    emit(
        file,
        "frontend",
        "semantic",
        "module.identity",
        observability.moduleId,
        observability.moduleId,
        sourcePath,
        null,
        { moduleId: observability.moduleId },
    );

    for (const node of collectAstNodes(ast)) {
        emit(
            file,
            "frontend",
            "semantic",
            "ast.node.identity",
            node.nodeId,
            observability.moduleId,
            sourcePath,
            node.position,
            {
                nodeId: node.nodeId,
                nodeKind: node.kind,
            },
        );
    }

    observability.values.forEach((value) => {
        emitValue(file, observability.moduleId, sourcePath, value);
    });
    observability.decisions.forEach((decision) => {
        emitDecision(file, observability.moduleId, sourcePath, decision);
    });
}

