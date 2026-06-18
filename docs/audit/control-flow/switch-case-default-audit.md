# Switch/Case/Default — Comprehensive Audit

> Last updated: 2026-06-17
> Files: `src/compiler/src/semantic/if.ts`, `src/compiler/src/semantic/functions.ts`, `statementLowerer.cpp/.h`, `loweringContext.h/.cpp`, `declarationLowerer.cpp`, `tests/runtime/sessions/04-control-flow/switch.cmake`, `tests/runtime/sessions/04-control-flow/break.cmake`, `tests/runtime/sessions/04-control-flow/switch_ownership.cmake`, `tests/runtime/sessions/04-control-flow/switch_definite_assignment.cmake`
>
> **Lot 04 bugs found and fixed (4 total):**
> 1. Move-state leak in switch: pre-switch aggregate escape caused double-free → fixed by restoring only switch name/type/alias maps after cleanup, keeping cleanup deactivations intact
> 2. `statementAlwaysReturns` missing `hasDefault` check → fixed
> 3. `findFunctionReturnStatements` not recursing into `SwitchStatement` → fixed
> 4. `statementTerminatesBlock` using `blockTerminates` instead of `blockAlwaysReturns` for switch → fixed
>
> **Lot 04 bug found and fixed (lowering):**
> 5. `break` inside loop-inside-switch incorrectly targeted switch instead of loop → fixed with unified `breakFrames` stack
>
> **Lot 05 changes (fall-through + shared scope + cleanupSlot):**
> - Fall-through execution: clause bodies are sequential in CFG; each emits an explicit `br` to the next clause body (or `switch.end`) — LLVM BasicBlocks cannot fall through implicitly
> - Shared switch scope: entire switch body uses one scope, JS/TS-compatible (no per-clause `restoreState`)
> - `default` can appear in any position (requirement removed); default is **not a comparison check**, it is a fallback entry block
> - `lowerBlock` not used for switch clause bodies (avoids spurious cleanup)
> - `cleanupSlot` indirection for path-sensitive aggregate cleanup safety; slot cleared to null after cleanup
> - `switchBodyDepth` tracking in lowering context
>
> **Lot 06 changes (definite assignment safety for fall-through):**
> - New diagnostic: `variable 'X' may be used before initialization` for switch fall-through cases where a later clause references a variable declared in an earlier clause
> - Pre-collection pass (`collectClauseVarDeclarations`) maps switch-body variable names to their declaration clause index
> - Check injected into `visitIdentifierExpression` in `base.ts` — fires when a switch-body variable from an earlier clause is referenced in a later clause
> - Works for both scalar and aggregate variable uses
> - Cleanup-only cases (declared but never used) remain valid
> - `switchBodyDeclClause`, `switchBodyCurrentClause`, and `switchBodyScopeId` state fields added to `base.ts`
> - Test suite: `switch_definite_assignment` (12 scenarios, including nested switch tracking and explicit block redeclaration)
>
> **Aggregate assignment audit split:**
> - General `target = source` aggregate ownership is documented in `docs/memory/aggregate-assignment.md`
> - Coverage table lives in `docs/audit/memory/aggregate-assignment-ownership-audit.md`
> - Test suite: `tests/runtime/sessions/03-memory-management/aggregate_assignment_ownership.cmake`

---

## 1. Feature Coverage Table

### 1.1 Core switch semantics

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| switch(number) with cases + default + break | ✅ | ✅ `classify` | 3-case pipeline test |
| switch(number) with cases, no default | ✅ | ✅ `noDefault` | IR and execution verified |
| switch(number) with fall-through (no break at end of case) | ✅ | ✅ | Sequential body blocks; fall-through to next case or default |
| switch with only default clause | 🟡 | ❌ | Covered by `lowerSwitch` wiring |
| switch with 0 clauses (empty body) | 🟡 | ❌ | Explicit early return at `lowerSwitch` |
| switch with 1 case + default | 🟡 | ❌ | Structurally covered by single-iteration loop |
| switch with 1 case, no default | 🟡 | ❌ | Single check → body → switch.end |
| switch with 5+ cases | 🟡 | ❌ | Scales linearly; no jump-table optimization |

### 1.2 Type checking

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| switch expression must be `number` | ✅ | 🟡 | `if.ts`; implicit in pipeline_switch |
| case expression must be `number` | ✅ | 🟡 | `if.ts` |
| non-number switch → diagnostic | ✅ | ❌ | Error thrown if not `isNumberType` |
| non-number case → diagnostic | ✅ | ❌ | Error thrown if not `isNumberType` |
| NaN doesn't match any case | ✅ | ❌ | `FCmpOEQ` returns false for NaN comparisons |

### 1.3 Default clause

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| default can appear in any position | ✅ | 🟡 | `if.ts` — `default must be last` check removed |
| duplicate default → error | ✅ | 🟡 | `if.ts` — still enforced |
| default as failure target for unmatched cases | ✅ | 🟡 | Default is **not a comparison check** — no `default.check` block exists. The last case check branches to the default body directly as its no-match target |
| switch without default → last check falls to switch.end | ✅ | 🟡 | |

### 1.4 Break

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| break inside switch exits switch | ✅ | ✅ | `lowerBreak` targets `breakFrames.back()`; tested in pipeline_switch, pipeline_break |
| break outside switch/loop → diagnostic | ✅ | ✅ | `if.ts` checks `loopDepth <= 0 && switchDepth <= 0`; tested in pipeline_break negative test |
| break inside loop-inside-switch exits loop (correct) | ✅ | ✅ | Unified `breakFrames` stack; tested in pipeline_break scenario 5 |
| break inside switch-in-loop exits switch (correct) | ✅ | ✅ | `breakFrames` stack has switch frame on top of loop frame; tested in pipeline_break scenario 4 |
| break executes cleanup of case-locals before jumping | ✅ | ✅ | `emitLocalCleanupsFrom(breakCleanupStart)`; tested in pipeline_switch, pipeline_break |
| nested switch (switch inside case) — break targets inner switch | ✅ | ✅ | `breakFrames` stack per nesting level; tested in pipeline_break scenario 6 |
| break in middle of fall-through chain → cleans only live aggregates | ✅ | ✅ | `cleanupSlot` null-check skips uninitialized aggregates |

### 1.5 Continue

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| continue inside switch case → targets enclosing loop | ✅ | ❌ | `lowerContinue` only checks loopFrames |
| continue outside loop → diagnostic | ✅ | ❌ | `if.ts` checks `loopDepth <= 0` |

### 1.6 Scope / variable isolation

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| **Shared switch scope**: entire switch body is one scope | ✅ | 🟡 | Semantic analysis wraps whole switch in one `BlockStatement`, not per-clause |
| Same name in different cases → redeclaration error | ✅ | 🟡 | Shared scope: name collision detected |
| No per-clause `restoreState` — state flows through fall-through paths | ✅ | 🟡 | Switch does NOT call `restoreState` between clauses. Ownership/cleanup state from earlier declarations remains valid on fall-through paths. This is correct for JS/TS-style fall-through |
| **Definite assignment**: variable from earlier clause used in later clause → diagnostic | ✅ | ✅ | `variable 'X' may be used before initialization` thrown in `visitIdentifierExpression`. Pre-collected via `collectClauseVarDeclarations`. Tested in `switch_definite_assignment` |
| **Definite assignment**: variable only declared, never used in later clauses → valid | ✅ | ✅ | No reference → no diagnostic. `cleanupSlot` handles cleanup safely |
| Variables inside switch don't leak after switch | ✅ | ✅ | Semantic scope exit plus LLVM name-map restore prevent switch-local names from shadowing outer locals after `switch.end` |

### 1.7 Cleanup of aggregates inside case/default

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| local aggregate → cleaned up before explicit break | ✅ | ✅ | `lowerBreak` calls `emitLocalCleanupsFrom` |
| local aggregate → cleaned up at switch.end (fall-through) | ✅ | ✅ | `lowerSwitch` calls `emitLocalCleanupsFrom` at switch.end |
| local aggregate inside default → cleaned up | ✅ | 🟡 | Same code path as case |
| aggregate returned from case → NOT cleaned up locally | ✅ | 🟡 | `deactivateAggregateOwner` + `emitLocalCleanups` skips inactive |
| aggregate escaped to global → NOT cleaned up locally | ✅ | ✅ | Plain identifier path covered by `yogi_pipeline_aggregate_assignment_ownership`; general ownership rules live in memory docs |
| **cleanupSlot path safety** — aggregate never initialized (direct entry to later case) | ✅ | ✅ | Slot zero-initialized at function entry; null-check skips cleanup |
| **cleanupSlot clearing** — slot nulled after cleanup for loop safety | ✅ | 🟡 | After `dropLocalAggregate`/`destroyEscapedAggregate`, a null store is emitted into the slot to prevent stale pointer on next loop iteration |
| **cleanupSlot does not protect reads** — definite assignment check is separate | ✅ | ✅ | cleanupSlot only prevents cleanup of uninitialized aggregates. Definite assignment (diagnostic in `visitIdentifierExpression`) prevents unsafe reads. Both are needed for fall-through safety |
| nested block inside case → cleans up its own locals | ✅ | 🟡 | `lowerBlock` tracks its own `firstCleanup` |
| return of non-aggregate (e.g., `return scores[0]`) → aggregate still cleaned up | ✅ | 🟡 | `lowerReturn` drops active aggregates |
| fall-through from case A to case B — no cleanup between | ✅ | ✅ | Sequential body blocks; no `lowerBlock` cleanup at boundaries |

### 1.8 statementAlwaysReturns

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| switch + default + all cases return → true | ✅ | 🟡 | `if.ts`; requires default + all bodies always-return |
| switch + grouped empty cases fall through to return → true | ✅ | ✅ | `grouped_fallthrough_always_returns`; empty cases can fall into a returning body |
| switch + no default + all cases return → false | ✅ | 🟡 | Fixed — `hasDefault` check added |
| switch + default + some cases break (not return) → false | ✅ | 🟡 | Not all bodies always-return |
| switch + default + default doesn't return → false | ✅ | 🟡 | `blockAlwaysReturns(default.body)` is false |

### 1.9 statementTerminatesBlock

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| switch + default + all cases return → block-terminating | ✅ | 🟡 | Uses `blockAlwaysReturns` (not `blockTerminates`) |
| switch + default + all cases break → NOT block-terminating | ✅ | 🟡 | **Fixed 2026-06-17**: `blockTerminates` was counting `break` as terminator |
| switch + no default → false | ✅ | 🟡 | Fixed |
| switch + some cases break, some return → NOT block-terminating | ✅ | 🟡 | At least one clause doesn't `blockAlwaysReturns` |
| code after switch inside while/for body is preserved | ✅ | ✅ | Tested in pipeline_break scenarios 4, 6 |

### 1.10 LLVM IR lowering

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| IR contains `switch.checkN` blocks | ✅ | ✅ | Verified in pipeline_switch IR check |
| IR contains `switch.caseN.body` blocks | ✅ | ✅ | Verified |
| IR contains `switch.default.body` | ✅ | ✅ | Verified |
| IR contains `switch.end` merge block | ✅ | ✅ | Verified |
| IR contains `fcmp oeq` comparison | ✅ | ✅ | Verified |
| **Fall-through**: clause body emits explicit branch to next clause body | ✅ | 🟡 | If no break/return/continue, lowering emits `br` to the next clause body (or `switch.end` for the last clause). LLVM blocks always require a terminator |
| no dead code after terminating clause body | ✅ | 🟡 | `hasTerminator()` check skips adding branch; clause-level lowering stops iterating |
| entry branches to first check or default | ✅ | 🟡 | |
| **cleanupSlot null-check branch** in cleanup code | ✅ | 🟡 | `agg.cleanup` / `agg.skip` basic blocks emitted in `emitLocalCleanupsFrom` |
| **cleanupSlot cleared to null** after cleanup | ✅ | 🟡 | Null store emitted after drop/destroy to prevent stale pointer on next loop iteration |

---

## 2. Specific scenario verification

### Scenario 1: Fall-through with aggregate declared in earlier case

```ts
function test(x: number): void {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]
        case 2:
            let other: number[] = [4, 5, 6]
            break
    }
}
```

**Semantic**: Single shared scope. `scores` and `other` are in the same scope, declared sequentially. There is no per-clause `restoreState` — move state and variable names persist through fall-through paths via shared scope.

**Lowering**:
1. Move state is captured at switch entry. No `restoreState` is called between clauses
2. `lowerVariable` for `scores` in clause 0 body → `registerAggregateOwner("scores", ..., cleanupSlot = slot)`
3. Clause 0 body does not end with break/return/continue → lowering emits `br label %switch.case1.body` (explicit branch to next clause)
4. `lowerVariable` for `other` in clause 1 body → `registerAggregateOwner("other", ..., cleanupSlot = slot)`
5. `lowerBreak` → `emitLocalCleanupsFrom(breakCleanupStart)`:
   - Checks `cleanupSlot` for `scores`: if initialized (x===1 path), drops it and clears slot to null; if null (x===2 direct entry), skips it
   - Checks `cleanupSlot` for `other`: always initialized (both entry paths reach clause 1) → drops it and clears slot to null
6. `CreateBr(switchEndBB)`

**Verdict**: ✅ Correct. Path-sensitive cleanup via cleanupSlot.

### Scenario 2: Return aggregate element (no escape)

```ts
function test(x: number): number {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]
            return scores[0]
        default:
            return 0
    }
}
```

**Semantic**: `scores[0]` is a scalar read (`number`), not an aggregate. `visitReturnStatement` checks `isAggregateType(value.type)` → false. No move marking.

**Lowering**:
1. `scores` allocated and registered with cleanupSlot
2. `scores[0]` → `values.lower(element_access)` → scalar `double`
3. `return scores[0]` → `lowerReturn`:
   - No `deactivateAggregateOwner` call
   - `emitLocalCleanups()` → iterates all, finds `scores` active → calls `dropLocalAggregate`
   - `CreateRet(returnValue)`

**Verdict**: ✅ Correct. `scores` is cleaned up before the return.

### Scenario 3: Return aggregate (escape)

```ts
function make(x: number): number[] {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]
            return scores
        default:
            return [0]
    }
}
```

**Semantic**: `visitReturnStatement` detects `scores` is aggregate type → calls `markAggregateExpressionMoved`. `scores` marked as moved (ownership → caller).

**Lowering**:
1. `scores` allocated and registered with cleanupSlot
2. `return scores`:
   - `deactivateAggregateOwner("scores")` → sets cleanup entry `active = false`
   - `emitLocalCleanups()` → skips inactive `scores` entry
   - `CreateRet(scoresValue)` — ownership transferred

**Verdict**: ✅ Correct. `scores` is deactivated, then `emitLocalCleanups` skips it.

### Scenario 4: Fall-through with two arrays, break in second case

```ts
function test(x: number): void {
    switch (x) {
        case 1:
            let a: number[] = [1, 2, 3]
        case 2:
            let b: number[] = [4, 5, 6]
            break
    }
}
```

**Two entry paths**:
- `x === 1`: enters `case 1`, initializes `a`, falls through to `case 2`, initializes `b`, hits `break`
- `x === 2`: enters `case 2` directly (skips `a`'s initialization), initializes `b`, hits `break`

**Cleanup at break**:
- `a.cleanupSlot`: if x===1 → has storage pointer → drop it; if x===2 → null → skip
- `b.cleanupSlot`: always non-null (both paths reach case 2) → drop it

**Verdict**: ✅ Correct. Path-sensitive cleanup via cleanupSlot null-check.

### Scenario 5: Escape to global

```ts
let saved: number[] = [0]
function test(x: number): void {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]
            saved = scores
            break
    }
}
```

**Semantic**: The assignment marks `scores` as escaped/moved into module storage.

**Lowering**:
- Plain identifier targets (`saved = scores`) use `lowerAssignment`
- `lowerAssignment` detects the target is a global and calls `deactivateAggregateOwner(rightName)` → `scores` deactivated
- If `saved` already owned an aggregate, the previous global value is destroyed before the replacement is stored

**Verdict**: ✅ Correct and covered by `yogi_pipeline_aggregate_assignment_ownership`. See `docs/audit/memory/aggregate-assignment-ownership-audit.md`.

---

## 3. Current Limitations

### 3.0 `findFunctionReturnStatements` doesn't recurse into SwitchStatement ✅ FIXED

**2026-06-17**: `findFunctionReturnStatements` in `functions.ts:721` only recursed into `BlockStatement` and `IfStatement`, missing `SwitchStatement`. Added `SwitchStatement` handling that recurses into all clause bodies.

### 3.1 ~Break inside loop-inside-switch targets switch instead of loop~ ✅ FIXED

**2026-06-17**: Replaced dual `switchFrames`/`loopFrames` stacks with single unified `breakFrames` stack. `lowerBreak` now pops `breakFrames.back()`, which is always the innermost break-targetable construct.

### 3.2 Escape-to-global for plain identifier aggregate assignment ✅ FIXED / VERIFIED

`lowerAggregateAssignment` handles property/element access targets. Plain identifier-to-identifier aggregate assignment (`saved = scores`) uses `lowerAssignment`, and is now covered by the memory-management suite:

```txt
tests/runtime/sessions/03-memory-management/aggregate_assignment_ownership.cmake
```

The dedicated audit lives at:

```txt
docs/audit/memory/aggregate-assignment-ownership-audit.md
```

### 3.3 Fall-through supported (no longer a limitation)

Yogi now supports JavaScript/TypeScript-style fall-through. Execution continues from matched case into subsequent cases. `break`/`return`/`continue` are required to exit early.

### 3.4 No LLVM `SwitchInst` optimization

Uses cascading `FCmpOEQ` + `CreateCondBr` (if-else chain). LLVM's `SwitchInst` requires integer type; Yogi's `f64` discriminant prevents its use.

### 3.5 Only `number` type supported

No `string` switch, no `boolean` switch, no union-type switch, no pattern matching. All case expressions must be number literals.

### 3.6 `default` in any position (no longer a limitation)

`default` can appear anywhere among the cases. The lowering inserts the check at the corresponding position in the comparison chain.

### 3.7 Definite assignment safety (new in Lot 06)

Variables declared in an earlier switch clause can be referenced in later clauses (shared scope), but may not be initialized if the later clause is entered directly. Yogi rejects such unsafe references at compile time.

**Rule**: A variable declared in clause N is unsafe to use in clause M > N (because clause M is a direct entry point).

**Implementation notes**:
- Pre-collects all `let`/`const` declarations from clause bodies (direct children only — blocks and compound statements are not recursed into)
- `switchBodyCurrentClause` is set to the current clause index during visitation
- In `visitIdentifierExpression`, if the resolved symbol was declared in an earlier switch clause, a diagnostic is thrown
- Only captures declarations directly in the shared switch scope (not inside explicit blocks)
- Does NOT handle temporal-dead-zone issues within the same clause (variables used before their declaration in the same clause body)
- Does NOT handle shadowing by nested block-scoped variables (conservative — may produce false positive in rare shadowing cases)

### 3.8 CleanupSlot safety (new in Lot 05)

The `cleanupSlot` mechanism solves the path-sensitivity problem for aggregate cleanup in fall-through switches:

- Each switch-body aggregate variable's entry-block `slot` is used as `cleanupSlot`
- The slot is zero-initialized at function entry (null pointer)
- When a declaration executes in a clause body, the aggregate storage pointer is stored into the slot
- At cleanup time (break/return/switch.end), the cleaner loads from the slot and null-checks before calling drop/destroy
- Aggregates declared in clauses that were never entered (because execution jumped directly to a later case) have null in their slot → cleanup safely skipped
- **After cleanup, the slot is cleared to null** — this prevents stale pointer issues on subsequent loop iterations when the switch is inside a loop
- **Dominance solved**: the slot is at function entry, which dominates all blocks. The aggregate storage alloca stays in the clause body (its size may depend on runtime values). The indirection through the slot connects them without violating LLVM SSA dominance.

---

## 4. Recommended Follow-up Tests

These are listed in priority order, within each priority roughly ordered by impact:

### ✅ Implemented (2026-06-17)

| # | What was done |
|---|---|
| 4 | `pipeline_break` scenario 4: switch inside while — break exits switch, loop continues |
| 5 | `pipeline_break` scenario 6: nested switch inside loop inside switch — break targets innermost |
| 6 | `switch_ownership`: full ownership/cleanup hardening test for escape via global assignment |
| — | `switch_ownership`: fall-through scenarios with cleanupSlot path safety |

### P0 — Remaining (correctness gaps)

| # | Test | What it would prove |
|---|---|---|
| 1 | Return aggregate from case body | Aggregate escape via return + deactivation + no local cleanup |
| 2 | Return aggregate from default | Same, but via default clause path |
| 3 | Return non-aggregate (scalar) that references local aggregate | Aggregate still cleaned up before return |
| 4 | Fall-through from case A to case B, aggregate in A cleaned on break in B | Path-sensitive cleanupSlot correctness |
| 5 | Scalar declared in earlier clause, assigned (not read) in later clause | Assignment counts as "use"? Currently yes (conservative) — review if too strict |
| 6 | Variable declared in if-body inside clause, referenced in later clause | Definite assignment with scope interaction |
| 7 | Variable inside explicit block in clause 1 — same name used in clause 2 | Block scope prevents false positive |
| 8 | Switch inside switch — nested definite assignment | Inner switch variables don't contaminate outer |

### P1 — Structural coverage (lowering paths)

| # | Test | What it would prove |
|---|---|---|
| 7 | Switch with only default clause (no case) | Single default body, no check blocks |
| 8 | Switch with 1 case + default | Single check → case body or default body |
| 9 | Switch with 3+ cases + default | Multi-way check chain; last case fails to default |
| 10 | `default` in middle of cases | Default check at correct position in chain |
| 11 | Empty cases (grouped values) | Fall-through from case to case |
| 12 | `break` outside switch/loop → diagnostic | ✅ Done — `pipeline_break` negative test |
| 13 | Continue inside switch case | Continue targets enclosing loop, not switch |
| 14 | Switch inside loop with fall-through + break (cleanupSlot reset) | Slot cleared between iterations to avoid stale pointer |

### P2 — Combined control flow

| # | Test | What it would prove |
|---|---|---|
| 15 | If inside case body | Combined if+switch CFG lowering |
| 16 | Switch inside if body (then and else) | Combined switch+if CFG lowering |
| 17 | for/while inside case body | Loop-inside-switch; break/continue behavior |
| 18 | Local aggregate in nested block inside case | Nested `lowerBlock` cleanup; `firstCleanup` tracking |
| 19 | switch inside for-loop initializer | Switch as loop body; all frame interactions |
| 20 | Aggregate escaped to callee (function call consumes it) | `deactivateAggregateOwner` via callee summary path |

### P3 — Error diagnostics

| # | Test | What it would prove |
|---|---|---|
| 21 | Non-number switch expression → error | Diagnostic message verified |
| 22 | Non-number case expression → error | Diagnostic message verified |
| 23 | Duplicate default → error | Diagnostic message verified |
| 24 | `break` outside switch/loop → error | Diagnostic message verified |
| 25 | `continue` outside loop → error inside switch case | Diagnostic message verified |
