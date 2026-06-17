# Lot 04: switch/case/default

## Anchored Summary

**Status**: ✅ Semantic analysis + LLVM lowering done. 5 bugs fixed (4 semantic, 1 lowering). Audit at `docs/audit/switch-case-default-audit.md`.

**Semantic** (`if.ts:243-298`):
- `visitSwitchStatement`: validates expression/case types are `number`, detects duplicate `default`, enforces default-last ordering, wraps each clause body in a `BlockStatement` for scope isolation, increments `switchDepth` for `break` validation
- Stores move state once before the switch, restores it before each clause body, collects per-clause move states, merges them after all clauses
- Switch must have a `default` clause for `statementAlwaysReturns`/`statementTerminatesBlock` to return true

**Lowering** (`statementLowerer.cpp:486-650`):
- if-else chain via `FCmpOEQ` (no LLVM `SwitchInst` — discriminant is `f64`)
- No fall-through: each case body branches to `switch.end`
- Unified `breakFrames` stack replaces old `switchFrames`/`loopFrames` dual stacks; `lowerBreak` always targets the innermost break-targetable construct (switch or loop)
- Case-local aggregates cleaned up via `lowerBlock`/`lowerBreak`/`lowerReturn`
- `restoreState(incomingState)` before each case body isolates scope
- **Ownership merge at `switch.end`**: pre-switch aggregate deactivations are tracked per-case and applied after full restore, preventing double-free when aggregates escape inside a case

**Known limitation (pre-existing)**: `statementTerminatesBlock` used `blockTerminates` (counts `break` as terminating) instead of `blockAlwaysReturns` for switch clauses → **FIXED 2026-06-17**. This caused statements after a `switch` inside a loop body to be silently dropped.

**Full audit**: `docs/audit/switch-case-default-audit.md` — complete coverage table (45+ items), scenario verifications, limitations, and 24 recommended follow-up tests.

## Switch Ownership and Cleanup Edge Cases

This section documents how `switch`/`case`/`default` interacts with Yogi's stack-first / RAII memory model, verified by the `pipeline_switch_ownership` test suite (12 tests, 10 scenarios).

### 1. Case/default scope behavior

Each case/default body is a **self-contained scope**:

- Variables declared inside a case live only inside that case
- The semantic analysis wraps each body in a `BlockStatement` (`visitSwitchClause`)
- The LLVM lowering calls `restoreState(incomingState)` before each case body, ensuring no cross-case state contamination
- Variables in different cases can have the same name without conflict

### 2. Cleanup before explicit break

When a case body ends with `break`:

```ts
case 1:
    let scores: number[] = [1, 2, 3]
    break
```

- `lowerBreak` calls `emitLocalCleanupsFrom(switchFrame.breakCleanupStart)`
- All aggregates created in that case body are dropped via `dropLocalAggregate`
- Then branches to `switch.end`

### 3. Cleanup before implicit branch to `switch.end`

When a case body ends without break/return (no fall-through — implicit branch):

```ts
case 1:
    let scores: number[] = [1, 2, 3]
```

- `lowerBlock` calls `emitLocalCleanupsFrom(firstCleanup)` at block exit
- All case-local aggregates are dropped
- `lowerSwitch` then adds `CreateBr(switchEndBB)`

### 4. Cleanup before return (value does not escape)

When returning a non-aggregate (scalar) from a case:

```ts
case 1:
    let scores: number[] = [1, 2, 3]
    return scores[0]   // scores is NOT consumed
```

- `lowerReturn` calls `emitLocalCleanups()` which drops `scores` (active, didn't escape)
- Then `CreateRet(returnValue)`

### 5. Returned aggregate ownership transfer

When returning an aggregate from a case:

```ts
case 1:
    let scores: number[] = [1, 2, 3]
    return scores      // ownership moves to caller
```

- `lowerReturn` calls `deactivateAggregateOwner("scores")` → cleanup entry set to inactive
- `emitLocalCleanups()` skips inactive entries → `scores` NOT dropped
- `CreateRet(scoresValue)` — ownership transferred
- The semantic analysis marks the expression as moved via `markAggregateExpressionMoved`

### 6. Escaped aggregate behavior

When an aggregate escapes to a global/module variable inside a case:

```ts
let saved: number[] = [0]
function test(x: number): void {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]
            saved = scores        // scores escapes to global
            break
    }
}
```

- `lowerAssignment` detects the target is a global (`context.globals.contains(name)`)
- Calls `deactivateAggregateOwner(rightName)` → `scores` cleanup marked inactive
- `lowerBreak` calls `emitLocalCleanupsFrom(breakCleanupStart)` — skips inactive `scores`
- No double-free

### 7. Pre-switch aggregate escaping inside a case (critical)

The most subtle case — an aggregate created BEFORE the switch that escapes inside a case:

```ts
let saved: number[] = [0]
function test(x: number): void {
    let scores: number[] = [1, 2, 3]      // created before switch
    switch (x) {
        case 1:
            saved = scores                 // escapes here
            break
    }
    // scores must NOT be cleaned here — it now belongs to saved
}
```

**The bug and fix**: `lowerSwitch` calls `restoreState(incomingState)` at `switch.end`, which restores the pre-switch cleanup state. If a pre-switch aggregate was deactivated inside a case, the full restore would **reactivate** its cleanup → **double-free**.

**Fix** (`statementLowerer.cpp:521-530, 655-660`):
- A `preSwitchDeactivated` vector tracks which pre-switch cleanup entries were deactivated in any case body
- After `restoreState(incomingState)` at `switch.end`, entries flagged in `preSwitchDeactivated` are explicitly set to `active = false`
- This mirrors the `mergeState` logic in `lowerIf`

### 8. Tests added

| Test file | Scenarios |
|---|---|
| `pipeline_switch_ownership.cmake` | 10 scenarios (see below) |

| # | Scenario | What it verifies |
|---|---|---|
| 1 | Aggregate inside case + explicit break | `scores` dropped before break |
| 2 | Aggregate inside case + implicit branch | `scores` dropped before implicit branch |
| 3 | Aggregate inside default | `fallback` dropped in default body |
| 4 | Aggregate inside case + returned | `scores` NOT dropped on return path |
| 5 | Aggregate inside case + global escape | `scores` deactivated, no double-free |
| 6 | Pre-switch aggregate + global escape (critical) | `restoreState` bug fixed, no double-free |
| 7 | Pre-switch aggregate + returned | Return path doesn't drops pre-switch aggregate |
| 8 | Pre-switch aggregate + not escaped | Cleanup still runs for non-escaping pre-switch aggregates |
| 9 | Same variable name in different cases | Scope isolation at lowering level |
| 10 | Switch inside loop + break | Break exits switch, loop continues |

### 9. Known limitations (resolved)

- ~~`break` inside loop-in-switch exits the switch instead of the loop~~ ✅ **FIXED 2026-06-17**: Unified `breakFrames` stack correctly targets innermost break-targetable construct
- ~~Statements after `switch` inside a loop body are silently dropped~~ ✅ **FIXED 2026-06-17**: `statementTerminatesBlock` changed from `blockTerminates` to `blockAlwaysReturns`
- Escape-to-property (`obj.prop = arr`) within case body: `lowerAggregateAssignment` handles it for globals; local object property escape paths need separate verification

## Objetivo

Implementar `switch`/`case`/`default` end-to-end: TypeScript parsing → semantic analysis → FBS serialization → LLVM lowering → runtime executable.

## Decisiones de Diseño

### Lowering: if-else chain (NO LLVM SwitchInst)

- El discriminante en Yogi es `f64` y LLVM SwitchInst solo acepta enteros
- Se usa `FCmpOEQ` (ordered equality) para comparaciones
- NaN nunca matchea ningún case (ordered equality con NaN es false)

### Sin fall-through

- Cada case body termina con un branch implícito a `switch.end`
- No hay ejecución automática del case siguiente
- C/JavaScript fall-through no está soportado

### default debe ser el último

- El semantic analysis rechaza `default` en cualquier posición que no sea la última
- Error: `default clause must be the last clause in a switch statement`

### Un solo default

- Duplicar `default` produce error: `A switch statement can only have one default clause`

### Tipos soportados: solo number (f64)

- El discriminante debe ser `number`
- Cada case expression debe ser `number`
- Error claro si se usan otros tipos

### break dentro de switch

- `break` dentro de un case sale del switch (no del loop contenedor)
- Implementado via `switchFrames` stack en el lowering
- `lowerBreak` checkea `switchFrames` antes de `loopFrames`

### Scope por case body

- Cada case/default body tiene su propio scope para variables locales
- `let arr: number[]` en case 1 y otro `let arr: number[]` en case 2 son válidos
- Implementado via `lowerBlock` que maneja enterScope/exitScope y cleanup

### Cleanup de agregados locales

- Variables declaradas dentro de un case body son destruidas al salir del case
- Cleanup ocurre antes del branch a `switch.end`
- `break` también ejecuta cleanup antes de saltar a `switch.end`

## Pipeline End-to-End

### 1. Source TypeScript

```typescript
function classify(x: number): number {
    let result: number = 0

    switch (x) {
        case 1:
            result = 10
            break

        case 2:
            result = 20
            break

        default:
            result = 99
            break
    }

    return result
}
```

### 2. AST Visitor (`conditional.ts`)

Produce nodos con `kind: Kinds.ControlFlow.SwitchStatement` y clauses con `CaseClause`/`DefaultClause`.

### 3. Semantic Analysis (`if.ts`)

`visitSwitchStatement`:
1. Valida que el discriminante sea `number`
2. Valida que cada case expression sea `number`
3. Valida que no haya duplicate default
4. Valida que default sea el último
5. Visita cada clause body como BlockStatement (scope local)
6. Incrementa/decrementa `switchDepth` para permitir `break`

### 4. FBS Schema (`sir.fbs`)

```flatbuffers
table CaseClause {
    expression: ValueRef;
    body: BlockStatement;
    source: string;
    position: SourcePosition;
}

table DefaultClause {
    body: BlockStatement;
    source: string;
    position: SourcePosition;
}

table SwitchStatement {
    expression: ValueRef;
    clauses: [SirNode];
    source: string;
    position: SourcePosition;
}
```

### 5. LLVM IR Generado

```
switch.check0:
    %switch.cmp0 = fcmp oeq double %x, 1.0
    br i1 %switch.cmp0, label %switch.case0.body, label %switch.check1

switch.check1:
    %switch.cmp1 = fcmp oeq double %x, 2.0
    br i1 %switch.cmp1, label %switch.case1.body, label %switch.default.body

switch.case0.body:
    ... body ...
    br label %switch.end

switch.case1.body:
    ... body ...
    br label %switch.end

switch.default.body:
    ... body ...
    br label %switch.end

switch.end:
    ... merge ...
```

### 6. C++ Lowering (`statementLowerer.cpp`)

`lowerSwitch` crea una cadena de if-else:
- Entry bloque → branch a `switch.check0`
- Cada `switch.checkN` compara discriminant == case value con `FCmpOEQ`
- Match → branch a `switch.caseN.body`
- No match → branch a siguiente check / default body / switch.end
- Cada case body se baja via `lowerBlock` (scope/cleanup automático)
- Si el body no termina con terminator → branch a switch.end
- Si el default no existe → último check branch a switch.end

## Tests

| Test | Cobertura |
|------|-----------|
| `pipeline_switch` | Compilación: IR contiene `switch.check0`, `switch.case0.body`, `switch.end`, `fcmp oeq` |
| `pipeline_switch` | Ejecución: binario corre sin error |
| `pipeline_switch` | 3 funciones: con default, sin default, con break |
| `pipeline_switch_ownership` | 10 escenarios de ownership/cleanup: break, implicit branch, default, return, global escape, pre-switch escape, loop + break, scope isolation |
| `pipeline_break` | 10 escenarios de break: while, for, switch, switch-in-while, while-in-switch, nested, aggregate cleanup, break-outside diagnostic |
