# Lot 04: switch/case/default (updated for Lot 05 fall-through)

## Anchored Summary

**Status**: ✅ Semantic analysis + LLVM lowering done. Now supports JavaScript/TypeScript-style fall-through semantics. Shared switch scope. Cleanup-slot safety for aggregates across fallthrough paths. Audit at `docs/audit/control-flow/switch-case-default-audit.md`.

**Semantic** (`if.ts:243-305`):
- `visitSwitchStatement`: validates expression/case types are `number`, detects duplicate `default`, allows `default` in any position, enters a single shared `BlockStatement` scope for the entire switch body (not per-clause scopes)
- Stores move state once before the switch, visits clauses sequentially in one shared switch scope, and merges the final reachable move state (no per-clause `restoreState` — the switch uses shared scope and fall-through)
- Switch must have a `default` clause for `statementAlwaysReturns`/`statementTerminatesBlock` to return true
- Explicit `{}` blocks inside cases create normal nested block scopes, matching TypeScript. This allows repeated `let` names in separate case blocks.

**Lowering** (`statementLowerer.cpp:486-650`):
- if-else chain via `FCmpOEQ` (no LLVM `SwitchInst` — discriminant is `f64`)
- **Fall-through**: clause bodies are lowered sequentially in source order. A matched case continues into the next clause body unless a `break`/`return`/`continue` terminates early
- Empty cases naturally group multiple values (no explicit "fall-through" annotation needed)
- `default` can appear at any position; it is **not a comparison check** — the lowering remembers it as the fallback entry block for the last case check's no-match branch
- Single shared scope: move state is captured at switch entry, then clauses share the same scope (no per-clause `enterScope`/`exitScope` or `restoreState`)
- Unified `breakFrames` stack replaces old `switchFrames`/`loopFrames` dual stacks; `lowerBreak` always targets the innermost break-targetable construct (switch or loop)
- Clause body aggregates are lowered directly (not via `lowerBlock`), so no spurious scope cleanup at block boundaries
- **CleanupSlot approach**: switch-body aggregates use an indirection through the variable's entry-block `slot`. The slot is zero-initialized at function entry; the clause body stores the aggregate storage pointer into the slot. At cleanup time, the cleaner loads from the slot and null-checks before calling `dropLocalAggregate`/`destroyEscapedAggregate`. After cleanup, the slot is cleared to null to prevent stale pointer issues on subsequent loop iterations
- **Scope restore at `switch.end`**: after cleanup, the backend restores only the pre-switch name/type/alias maps. It keeps the current cleanup state, so pre-switch aggregates moved or escaped inside a case stay deactivated and switch-local names do not leak after the switch.

**Known limitation (pre-existing)**: `statementTerminatesBlock` used `blockTerminates` (counts `break` as terminating) instead of `blockAlwaysReturns` for switch clauses → **FIXED 2026-06-17**. This caused statements after a `switch` inside a loop body to be silently dropped.

**Full audit**: `docs/audit/control-flow/switch-case-default-audit.md` — complete coverage table (45+ items), scenario verifications, limitations, and recommended follow-up tests.

## Switch Ownership and Cleanup Edge Cases

This section documents how `switch`/`case`/`default` interacts with Yogi's stack-first / RAII memory model, verified by the `tests/runtime/sessions/04-control-flow/switch_ownership.cmake` test suite.

### 1. Shared switch scope (no per-clause isolation)

The entire `switch` body uses **one shared scope**, matching JavaScript/TypeScript semantics:

- Variables declared in one case are visible in subsequent cases (fall-through can see them)
- Same-named variables across different cases cause a redeclaration error (no per-clause scope hiding)
- Move state is captured at switch entry and flows through clause bodies sequentially with NO `restoreState` calls between clauses — this ensures ownership/cleanup state from earlier declarations remains valid on fall-through paths
- Developers can use explicit `{}` blocks within a case for finer scoping

### 2. Fall-through execution

When a case matches, execution begins at that case and continues into subsequent cases in source order:

```ts
case 1:
    let scores: number[] = [1, 2, 3]
    // fall through to case 2
case 2:
    console.log(scores[0])  // scores is visible (shared scope)
    break
```

- Each clause body that does not end with `break`/`return`/`continue` emits an explicit `br` to the next clause body in source order (or to `switch.end` if it is the last clause). LLVM BasicBlocks must always have a terminator — there is no implicit fall-through between blocks
- `break`/`return`/`continue` are required to exit the switch early
- Empty cases naturally group multiple values

### 3. Cleanup before explicit break

When a case body ends with `break`:

```ts
case 1:
    let scores: number[] = [1, 2, 3]
    break
```

- `lowerBreak` calls `emitLocalCleanupsFrom(switchFrame.breakCleanupStart)`
- All aggregates created in reachable clause bodies are cleaned (using `cleanupSlot` null-check for those only initialized on certain paths)
- Then branches to `switch.end`

### 4. Cleanup via `switch.end` (fall-through reaches the end)

When execution falls through all matched cases to `switch.end`:

```ts
case 1:
    let scores: number[] = [1, 2, 3]   // initialized
    // fall through
default:
    let fallback: number[] = [0, 0, 0]  // also initialized
    // no break — falls to switch.end
```

- At `switch.end`, `emitLocalCleanupsFrom(switchCleanupStart)` cleans all live aggregates
- `scores` and `fallback` are both dropped
- If execution entered `default` directly (bypassing `case 1`), `scores`'s `cleanupSlot` is still null → null-check skips it
- This is the path-sensitive cleanup guarantee

### 5. Cleanup before return (value does not escape)

When returning a non-aggregate (scalar) from a case:

```ts
case 1:
    let scores: number[] = [1, 2, 3]
    return scores[0]   // scores is NOT consumed
```

- `lowerReturn` calls `emitLocalCleanups()` which drops `scores` (active, didn't escape)
- Then `CreateRet(returnValue)`

### 6. Returned aggregate ownership transfer

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

### 7. Escaped aggregate behavior

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

### 8. Pre-switch aggregate escaping inside a case (critical)

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

**The bug and fix**: early versions restored the full pre-switch lowering state at `switch.end`. That brought back the old cleanup state, so a pre-switch aggregate deactivated inside a case could be reactivated → **double-free**.

**Fix** (`statementLowerer.cpp`):
- Capture the incoming name/type/alias state before lowering the switch.
- Lower all clause bodies through one shared switch scope.
- At `switch.end`, call `emitLocalCleanupsFrom(switchCleanupStart)`.
- Restore only `locals`, `localTypes`, `localTypeKinds`, and `aggregateAliases`.
- Keep `localAggregateCleanups` as-is after cleanup, preserving deactivations caused by returns, global stores, and other escapes.

### 9. CleanupSlot behavior

For aggregates declared inside a switch body (may or may not be initialized depending on which case was entered):

```ts
switch (x) {
    case 1:
        let scores: number[] = [1, 2, 3]   // initialized only if x === 1
        // fall through
    case 2:
        break                               // cleanup must not crash if scores was never initialized
}
```

**The problem**: If `x === 2`, execution enters at `case 2` directly. `scores` is never initialized, but at `break` time the cleaner would try to call `dropLocalAggregate` on garbage memory.

**The solution — cleanupSlot indirection**:
- `scores`'s entry-block `slot` is used as the `cleanupSlot`
- Zero-initialized at function entry (null/zero pointer)
- When `case 1` executes, the storage pointer is stored into the slot
- At cleanup time (break/return/switch.end):
  1. Load the pointer from `cleanupSlot`
  2. Null-check: if null → skip (aggregate was never initialized)
  3. If non-null → call `dropLocalAggregate` or `destroyEscapedAggregate`
  4. **Clear the slot to null** → this prevents stale pointer issues on subsequent loop iterations when the switch is inside a loop

### 10. Definite assignment safety with fall-through

Variables declared in an earlier clause are visible in later clauses because the switch has shared scope. However, **visibility does not equal definite initialization** — a later clause can be entered directly, skipping the declaration:

```ts
switch (x) {
    case 1:
        let value: number = 10    // declared here

    case 2:
        return value              // unsafe if x === 2 (entry at case 2)
}
```

Yogi rejects uses of switch-body variables that may read/move/return/escape an uninitialized value on any entry path.

**Rule**: A variable declared in clause N is unsafe to use in clause M > N because clause M can be entered directly (any case/default clause is a direct entry point).

**Implementation** (`if.ts`, `base.ts`):
- Before visiting clauses, `collectClauseVarDeclarations` pre-collects all `let`/`const` declarations in the switch body, mapping variable name → clause index
- During visiting, `switchBodyCurrentClause` tracks which clause is being processed
- In `visitIdentifierExpression`, if the identifier resolves to a switch-body variable whose declaration clause is earlier than the current clause, a diagnostic is thrown: `variable 'X' may be used before initialization`

**Safe patterns**:
- Declaration and use in the same clause (with return/break before fall-through)
- Empty case grouping (all entry points reach the declaration)
- Explicit block `{}` (block scope isolates the variable)
- Variable declared before the switch (initialized at switch entry)

**cleanupSlot is NOT a substitute**: cleanupSlot prevents cleanup of uninitialized aggregates, but does not make reads safe. Definite assignment and cleanupSlot work together — one protects reads, the other protects cleanup.

### 11. Tests

| Test file | Scenarios |
|---|---|
| `tests/runtime/sessions/04-control-flow/switch.cmake` | Basic fall-through IR and execution |
| `tests/runtime/sessions/04-control-flow/switch_ownership.cmake` | Ownership/cleanup scenarios |
| `tests/runtime/sessions/04-control-flow/switch_definite_assignment.cmake` | Switch shared-scope definite assignment |
| `tests/runtime/sessions/04-control-flow/break.cmake` | Break behavior across switch/loop |

| # | Scenario | What it verifies |
|---|---|---|
| 1 | Aggregate inside case + explicit break | `scores` dropped before break |
| 2 | Aggregate inside case + fall-through to switch.end | `scores` cleaned via `switch.end` |
| 3 | Aggregate inside default | `fallback` dropped in default body |
| 4 | Aggregate inside case + returned | `scores` NOT dropped on return path |
| 5 | Aggregate inside case + global escape | `scores` deactivated, no double-free |
| 6 | Pre-switch aggregate + global escape (critical) | name-map restore keeps cleanup deactivation intact; no double-free |
| 7 | Pre-switch aggregate + returned | Return path doesn't drop pre-switch aggregate |
| 8 | Pre-switch aggregate + not escaped | Cleanup still runs for non-escaping pre-switch aggregates |
| 9 | Same variable name in different cases | ~~Scope isolation~~ → Shared scope: redeclaration error |
| 10 | Switch inside loop + break | Break exits switch, loop continues |
| 11 | Fall-through from case to next case | Sequential body blocks, explicit branch to next body |
| 12 | Direct entry to later case (skip earlier aggregate init) | `cleanupSlot` null-check prevents double-free |
| 13 | Aggregate declared in earlier case, cleaned on later break | Fall-through + break cleanup |

## Objetivo

Implementar `switch`/`case`/`default` end-to-end: TypeScript parsing → semantic analysis → FBS serialization → LLVM lowering → runtime executable.

## Decisiones de Diseño

### Lowering: if-else chain (NO LLVM SwitchInst)

- El discriminante en Yogi es `f64` y LLVM SwitchInst solo acepta enteros
- Se usa `FCmpOEQ` (ordered equality) para comparaciones
- NaN nunca matchea ningún case (ordered equality con NaN es false)

### Fall-through (JS/TS-style)

- Un case que matchea comienza ejecución en ese punto y continúa secuencialmente al siguiente case/default
- Cada clause body que no termina con `break`/`return`/`continue` emite un `br` explícito al siguiente clause body (o a `switch.end` si es el último). LLVM BasicBlocks siempre deben tener un terminator — no existe fall-through implícito entre bloques
- `break`/`return`/`continue` son necesarios para salir del switch antes de tiempo
- Casos vacíos agrupan múltiples valores naturalmente (no se necesita sintaxis especial)
- Implementado mediante bodies secuenciales en el CFG, no mediante if-else anidados por clause

### default en cualquier posición

- El semantic analysis ya no exige que `default` sea el último
- `default` puede aparecer en cualquier lugar entre los cases
- `default` **no es una comparación**: el lowering NO crea un `default.check`. Default es meramente el bloque de entrada de fallback. La cadena de comparaciones solo itera sobre los cases; si ningún case matchea, el último check brancha al body de default
- `default` duplicado sigue siendo error

### Un solo default

- Duplicar `default` produce error: `A switch statement can only have one default clause`

### Tipos soportados: solo number (f64)

- El discriminante debe ser `number`
- Cada case expression debe ser `number`
- Error claro si se usan otros tipos

### break dentro de switch

- `break` dentro de un case sale del switch (o del loop más interno si está dentro de un loop dentro del switch)
- Implementado via unified `breakFrames` stack (reemplaza los antiguos `switchFrames`/`loopFrames`)
- `lowerBreak` siempre apunta al constructo breakable más interno

### Shared scope (no per-clause scope)

- Todo el cuerpo del switch comparte un solo scope
- `let arr: number[]` en case 1 y otro `let arr: number[]` en case 2 son error de redeclaración
- Para scoping más fino, el usuario puede usar bloques `{}` explícitos dentro de un case
- Implementado envolviendo todo el switch en un solo `enterScope`/`exitScope`

### Cleanup de agregados con fall-through

- Variables declaradas en un case que hace fall-through NO son destruidas al pasar al siguiente case
- Cleanup ocurre solo al salir del switch (break/return/continue/end-of-switch)
- Para seguridad con path-sensitive initialization (agregados que solo se inicializan en ciertos paths de entrada):
  - Se usa `cleanupSlot` (el `slot` del entry-block de la variable)
  - El slot se inicializa a null/zero al inicio de la función
  - Cuando el clause body ejecuta la declaración, almacena el puntero del aggregate en el slot
  - Al hacer cleanup, se carga del slot y se checkea null antes de llamar a drop/destroy
  - Después del cleanup, el slot se limpia a null para evitar punteros obsoletos en futuras iteraciones del loop

## Pipeline End-to-End

### 1. Source TypeScript

```typescript
function classify(x: number): number {
    switch (x) {
        case 1:
            print("one")
            // fall through
        case 2:
            print("one or two")
            break
        default:
            print("other")
            break
    }
}
```

### 2. AST Visitor (`conditional.ts`)

Produce nodos con `kind: Kinds.ControlFlow.SwitchStatement` y clauses con `CaseClause`/`DefaultClause`.

### 3. Semantic Analysis (`if.ts`)

`visitSwitchStatement`:
1. Valida que el discriminante sea `number`
2. Valida que cada case expression sea `number`
3. Valida que no haya duplicate default
4. ~~Valida que default sea el último~~ (removed — default can appear anywhere)
5. Visita el cuerpo del switch como un solo BlockStatement (scope compartido)
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
    br label %switch.case1.body             // explicit branch to next clause body

switch.case1.body:
    ... body ...
    br label %switch.end

switch.default.body:
    ... body ...
    br label %switch.end

switch.end:
    ... merge ...
```

Note: `switch.case0.body` emits an explicit `br` to `switch.case1.body`. LLVM BasicBlocks cannot fall through implicitly — every block must end with a terminator. The lowering emits a `br` to the next clause body in source order (or to `switch.end` for the last clause).

### 6. C++ Lowering (`statementLowerer.cpp`)

`lowerSwitch`:
- Entry block → branch to `switch.check0`
- Each `switch.checkN` compares discriminant == case value with `FCmpOEQ`
  - Match → branch to `switch.caseN.body`
  - No match → branch to next check / default body / switch.end
- Clause bodies in source order (sequential, no per-block cleanup/scope)
- Each clause body's statements are lowered inline (not via `lowerBlock`) to avoid spurious scope cleanup
- If a clause body doesn't end with a terminator → emits an explicit `br` to the next clause body (or `switch.end` for the last clause)
- `break`/`return`/`continue` within a body emit the appropriate terminator + cleanup
- At `switch.end`: `emitLocalCleanupsFrom(switchCleanupStart)` cleans remaining aggregates
- `cleanupSlot` indirection ensures aggregates only initialized on certain entry paths are safely skipped
- After cleanup, the `cleanupSlot` is cleared to null to prevent stale pointer issues on subsequent loop iterations

## Tests

| Test | Cobertura |
|------|-----------|
| `switch` | Compilación: IR contiene `switch.check0`, `switch.case0.body`, `switch.end`, `fcmp oeq` |
| `switch` | Ejecución: binario corre sin error |
| `switch` | Funciones: con default, sin default, con default en el medio, con break, fall-through, shadowing después del switch |
| `switch_ownership` | Escenarios de ownership/cleanup: break, fall-through, default, return, global escape, pre-switch escape, loop + break, cleanupSlot path safety |
| `switch_definite_assignment` | Diagnósticos de use-before-init por fall-through, nested switch, y bloques explícitos tipo TypeScript |
| `break` | Escenarios de break: while, for, switch, switch-in-while, while-in-switch, nested, aggregate cleanup, break-outside diagnostic |

## Historical note

Lot 04 initially implemented no-fall-through switch semantics (each case body auto-branched to `switch.end`, per-clause scopes, `default` must be last).

Lot 05 changed switch to JavaScript/TypeScript-style fall-through: sequential body CFG, shared switch scope, `default` in any position, and `cleanupSlot`-based path-sensitive aggregate cleanup safety. The old `switchFrames` stack was removed in favor of the unified `breakFrames` stack.
