# Switch/Case/Default — Comprehensive Audit

> Last updated: 2026-06-17
> Files: `src/compiler/src/semantic/if.ts`, `src/compiler/src/semantic/functions.ts`, `statementLowerer.cpp/.h`, `pipeline_switch.cmake`, `pipeline_break.cmake`, `pipeline_switch_ownership.cmake`
>
> **Bugs found and fixed (4 total):**
> 1. Move-state leak in switch: pre-switch aggregate escape caused double-free → fixed with `preSwitchDeactivated` tracking
> 2. `statementAlwaysReturns` missing `hasDefault` check → fixed
> 3. `findFunctionReturnStatements` not recursing into `SwitchStatement` → fixed
> 4. `statementTerminatesBlock` using `blockTerminates` instead of `blockAlwaysReturns` for switch → fixed
>
> **Bug found and fixed (lowering):**
> 5. `break` inside loop-inside-switch incorrectly targeted switch instead of loop → fixed with unified `breakFrames` stack

---

## 1. Feature Coverage Table

### 1.1 Core switch semantics

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| switch(number) with cases + default + break | ✅ | ✅ `classify` | 3-case pipeline test |
| switch(number) with cases, no default | ✅ | ✅ `noDefault` | IR and execution verified |
| switch(number) with cases, no break (fallthrough to end) | ⚠️ | ✅ `noFallthrough` | Implicit branch to switch.end |
| switch with only default clause | 🟡 | ❌ | Covered by `lowerSwitch` wiring (line 558-561) |
| switch with 0 clauses (empty body) | 🟡 | ❌ | Explicit early return at `lowerSwitch:511-515` |
| switch with 1 case + default | 🟡 | ❌ | Structurally covered by single-iteration loop |
| switch with 1 case, no default | 🟡 | ❌ | Single check → body → switch.end |
| switch with 5+ cases | 🟡 | ❌ | Scales linearly; no jump-table optimization |

### 1.2 Type checking

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| switch expression must be `number` | ✅ | 🟡 | `if.ts:246-255`; implicit in pipeline_switch |
| case expression must be `number` | ✅ | 🟡 | `if.ts:304-313` |
| non-number switch → diagnostic | ✅ | ❌ | Error thrown if not `isNumberType` |
| non-number case → diagnostic | ✅ | ❌ | Error thrown if not `isNumberType` |
| NaN doesn't match any case | ✅ | ❌ | `FCmpOEQ` returns false for NaN comparisons |

### 1.3 Default clause

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| default must be last clause | ✅ | 🟡 | `if.ts:275-283`; error thrown |
| duplicate default → error | ✅ | 🟡 | `if.ts:262-271` |
| default as failure target for unmatched cases | ✅ | 🟡 | Wired via `nextBB` at `:573-581` |
| switch without default → last check falls to switch.end | ✅ | 🟡 | `:580-581` |

### 1.4 Break

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| break inside switch exits switch | ✅ | ✅ | `lowerBreak:461-469`; tested in pipeline_switch, pipeline_break |
| break outside switch/loop → diagnostic | ✅ | ✅ | `if.ts:217-222` checks `loopDepth <= 0 && switchDepth <= 0`; tested in pipeline_break negative test |
| break inside loop-inside-switch exits loop (correct) | ✅ | ✅ | Unified `breakFrames` stack; `lowerBreak` uses `breakFrames.back()`; tested in pipeline_break scenario 5 |
| break inside switch-in-loop exits switch (correct) | ✅ | ✅ | `breakFrames` stack has switch frame on top of loop frame; tested in pipeline_break scenario 4 |
| break executes cleanup of case-locals before jumping | ✅ | ✅ | `emitLocalCleanupsFrom(breakCleanupStart)` at `:468`; tested in pipeline_switch, pipeline_break |
| nested switch (switch inside case) — break targets inner switch | ✅ | ✅ | `breakFrames` stack per nesting level; tested in pipeline_break scenario 6 |

### 1.5 Continue

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| continue inside switch case → targets enclosing loop | ✅ | ❌ | `lowerContinue:475-483` only checks loopFrames |
| continue outside loop → diagnostic | ✅ | ❌ | `if.ts:230-235` checks `loopDepth <= 0` |

### 1.6 Scope / variable isolation

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| each case body has its own BlockStatement scope | ✅ | 🟡 | `visitSwitchClause:316-320` wraps body in `visitBlockStatement` |
| variables with same name in different cases | ✅ | 🟡 | Each case starts from `restoreState(incomingState)` |
| variables inside case don't leak after switch | ✅ | 🟡 | `lowerSwitch:622` restores incomingState; semantic scope exits |
| lowering: `restoreState(incomingState)` before each case | ✅ | 🟡 | `:596,609` — prevents cross-case contamination |

### 1.7 Cleanup of aggregates inside case/default

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| local aggregate → cleaned up before explicit break | ✅ | ✅ | case2 in pipeline_switch: `scores` + `other` + break |
| local aggregate → cleaned up before implicit branch to switch.end | ✅ | 🟡 | `lowerBlock:168-169` calls `emitLocalCleanupsFrom(firstCleanup)`; `lowerSwitch:601-602` then branches |
| local aggregate inside default → cleaned up | ✅ | 🟡 | Same code path as case (both use `lowerBlock`) |
| aggregate returned from case → NOT cleaned up locally | ✅ | 🟡 | `lowerReturn:264-265` calls `deactivateAggregateOwner("scores")`, then `emitLocalCleanups():268` skips it |
| aggregate returned from default → NOT cleaned up locally | ✅ | 🟡 | Same code path |
| aggregate escaped to property (obj.prop = arr) | 🟡 | ❌ | `lowerAggregateAssignment:534-537` deactivates RHS if target object is global |
| aggregate escaped to global (saved = scores) | ⚠️ | ❌ | See §3 — depends on assignment lowering path for identifier targets |
| aggregate consumed by function call | 🟡 | ❌ | Depends on callee summary / semantic move marking |
| nested block inside case → cleans up its own locals | ✅ | 🟡 | `lowerBlock:158-170` tracks its own `firstCleanup` |
| return of non-aggregate (e.g., `return scores[0]`) → aggregate still cleaned up | ✅ | 🟡 | `lowerReturn:248-270`: element access returns scalar, but `scores` still active → `emitLocalCleanups()` drops it |

### 1.8 statementAlwaysReturns

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| switch + default + all cases return → true | ✅ | 🟡 | `if.ts:499-507`; requires default + all bodies always-return |
| switch + no default + all cases return → false | ✅ | 🟡 | Fixed — `hasDefault` check added |
| switch + default + some cases break (not return) → false | ✅ | 🟡 | Not all bodies always-return |
| switch + default + default doesn't return → false | ✅ | 🟡 | `blockAlwaysReturns(default.body)` is false |

### 1.9 statementTerminatesBlock

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|---|
| switch + default + all cases return → block-terminating | ✅ | 🟡 | Uses `blockAlwaysReturns(clause.body)` (not `blockTerminates`) |
| switch + default + all cases break → NOT block-terminating | ✅ | 🟡 | **Fixed 2026-06-17**: `blockTerminates` was counting `break` as terminator, causing statements after switch inside loops to be silently dropped |
| switch + no default → false | ✅ | 🟡 | Fixed |
| switch + some cases break, some return → NOT block-terminating | ✅ | 🟡 | At least one clause doesn't `blockAlwaysReturns` |
| code after switch inside while/for body is preserved | ✅ | ✅ | **Fixed 2026-06-17**: tested in pipeline_break scenarios 4, 6 |

### 1.10 LLVM IR lowering

| Feature / Case | Status | Test? | Notes |
|---|---|---|---|
| IR contains `switch.checkN` blocks | ✅ | ✅ | Verified in pipeline_switch IR check |
| IR contains `switch.caseN.body` blocks | ✅ | ✅ | Verified |
| IR contains `switch.default.body` | ✅ | ✅ | Verified |
| IR contains `switch.end` merge block | ✅ | ✅ | Verified |
| IR contains `fcmp oeq` comparison | ✅ | ✅ | Verified |
| each case body branches to `switch.end` when no terminator | ✅ | 🟡 | `lowerSwitch:601-602` |
| no dead code after terminating case body | ✅ | 🟡 | `hasTerminator()` check at `:601` skips branch; `lowerBlock:161` stops iterating |
| entry branches to first check or default | ✅ | 🟡 | `:556-562` |

---

## 2. Specific scenario verification

### Scenario 1: Two cases, each with local arrays + break

```ts
function test(x: number): void {
    switch (x) {
        case 1:
            let scores: number[] = [1, 2, 3]
            break
        case 2:
            let other: number[] = [4, 5, 6]
            break
    }
}
```

**Semantic**: `scores` and `other` are each in their own `BlockStatement` scope (separate `enterScope`/`exitScope` cycles). Move state is restored to `beforeMoveState` before each clause, so neither sees the other's declarations.

**Lowering**: Each case body:
1. `restoreState(incomingState)` — clean state, no `scores` or `other`
2. `variables.lowerVariable` → `registerAggregateOwner("scores", ...)` → cleanup entry added
3. `lowerBreak` → `emitLocalCleanupsFrom(breakCleanupStart)` → drops `scores` → `CreateBr(switchEndBB)`
4. Switch frame popped

Case 2 repeats identically with `other`. At `switch.end`: `restoreState(incomingState)`.

**Verdict**: ✅ Correct. Separate scopes, separate cleanup.

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

**Semantic**: `scores[0]` is a scalar read (`number`), not an aggregate. `visitReturnStatement:177` checks `isAggregateType(value.type)` → false. No move marking. `scores` still alive after the return expression in the semantic model.

**Lowering**:
1. `scores` allocated and registered
2. `scores[0]` → `values.lower(element_access)` → scalar `double`
3. `return scores[0]` → `lowerReturn`:
   - `identiferName(statement->value())` → `""` (element access, not identifier)
   - No `deactivateAggregateOwner` call
   - `emitLocalCleanups()` → iterates all, finds `scores` active → calls `dropLocalAggregate`
   - `CreateRet(returnValue)`

**Verdict**: ✅ Correct. `scores` is cleaned up before the return. The scalar element access doesn't consume the array.

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

**Semantic**: `visitReturnStatement:177` detects `scores` is aggregate type → calls `markAggregateExpressionMoved`. `scores` marked as moved (ownership → caller).

**Lowering**:
1. `scores` allocated and registered
2. `return scores`:
   - `identiferName(statement->value())` → `"scores"`
   - `deactivateAggregateOwner("scores")` → sets cleanup entry `active = false`
   - `emitLocalCleanups()` → skips inactive `scores` entry
   - `CreateRet(scoresValue)` — ownership transferred

**Verdict**: ✅ Correct. `scores` is deactivated, then `emitLocalCleanups` skips it.

### Scenario 4: Escape to global

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

**Semantic**: The `AggregateAssignmentExpression` semantic analysis should mark `scores` as moved (ownership transfers from local to global). This depends on the semantic analysis of assignments.

**Lowering** (what the code DOES):
- `lowerAggregateAssignment:520-557` handles property access (`.prop`) and element access (`[index]`) targets
- For property targets where the object is a global: calls `deactivateAggregateOwner(rightName)` → `scores` deactivated ✅
- For plain identifier targets (`saved = scores`): path not shown in the explored code; depends on `lowerAssignment`

**Verdict**: ⚠️ Needs review. Property-escape case (e.g. `obj.prop = scores` with global `obj`) is handled. Plain identifier-to-identifier aggregate assignment escape path needs verification. See §3.

---

## 3. Current Limitations

### 3.0 `findFunctionReturnStatements` doesn't recurse into SwitchStatement ✅ FIXED

**2026-06-17**: `findFunctionReturnStatements` in `functions.ts:721` only recursed into `BlockStatement` and `IfStatement`, missing `SwitchStatement`. This caused `statementAlwaysReturns` to incorrectly report `false` for functions whose only return statements were inside switch case bodies. Added `SwitchStatement` handling that recurses into all clause bodies.

### 3.1 ~Break inside loop-inside-switch targets switch instead of loop~ ✅ FIXED

**2026-06-17**: Replaced the dual `switchFrames`/`loopFrames` stacks with a single unified `breakFrames` stack. `lowerBreak` now pops `breakFrames.back()`, which is always the innermost break-targetable construct (switch or loop). This correctly handles:

```ts
switch (x) {
    case 1:
        while (cond) {
            break   // ✅ now correctly exits the while loop
        }
        break       // ✅ exits the switch
}
```

**Implementation**: The `BreakFrame` struct holds `{breakBlock, breakCleanupStart}`. `lowerWhile`/`lowerFor` push a break frame targeting the loop end; `lowerSwitch` pushes a break frame targeting `switch.end`. The old `switchFrames` vector was removed.

### 3.2 Escape-to-global for plain identifier aggregate assignment

`lowerAggregateAssignment` (valueLowerer.cpp:520-557) handles property/element access targets, but the path for plain identifier-to-identifier aggregate assignment (`saved = scores` where both are identifiers) in the aggregate case needs separate verification. If `lowerAssignment` doesn't deactivate the RHS, the escaped aggregate would also be cleaned up locally → double-free.

**Note**: The semantic analysis SHOULD mark `scores` as moved in this case. The lowering then needs to respect that by deactivating the cleanup entry. The `deactivateAggregateOwner` function exists and works; it's a question of whether it's called in all escape paths.

### 3.3 No fall-through

Each case body is independent. Yogi does not support C/JavaScript-style fall-through where execution continues into the next case. This is a language design choice.

### 3.4 No LLVM `SwitchInst` optimization

Uses cascading `FCmpOEQ` + `CreateCondBr` (if-else chain). LLVM's `SwitchInst` requires integer type; Yogi's `f64` discriminant prevents its use. A future optimization could use `switch` on integer types or build a jump-table manually for densely-packed `f64` values.

### 3.5 Only `number` type supported

No `string` switch, no `boolean` switch, no union-type switch, no pattern matching. All case expressions must be number literals.

### 3.6 `default` must be the last clause

Unlike C/JavaScript where `default` can appear anywhere, Yogi requires `default` to be the final clause. This is a language design choice.

---

## 4. Recommended Follow-up Tests

These are listed in priority order, within each priority roughly ordered by impact:

### ✅ Implemented (2026-06-17)

| # | What was done |
|---|---|
| 4 | `pipeline_break` scenario 4: switch inside while — break exits switch, loop continues |
| 5 | `pipeline_break` scenario 6: nested switch inside loop inside switch — break targets innermost |
| 6 | `pipeline_switch_ownership`: full ownership/cleanup hardening test for escape via global assignment |

### P0 — Remaining (correctness gaps)

| # | Test | What it would prove |
|---|---|---|
| 1 | Return aggregate from case body | Aggregate escape via return + deactivation + no local cleanup |
| 2 | Return aggregate from default | Same, but via default clause path |
| 3 | Return non-aggregate (scalar) that references local aggregate | Aggregate still cleaned up before return |

### P1 — Structural coverage (lowering paths)

| # | Test | What it would prove |
|---|---|---|
| 7 | Switch with only default clause (no case) | Single default body, no check blocks |
| 8 | Switch with 1 case + default | Single check → case body or default body |
| 9 | Switch with 3+ cases + default | Multi-way check chain; last case fails to default |
| 10 | Duplicate variable names in different cases | Scope isolation at semantic AND lowering level |
| 11 | `break` outside switch/loop → diagnostic | ✅ Done — `pipeline_break` negative test |
| 12 | Continue inside switch case | Continue targets enclosing loop, not switch |

### P2 — Combined control flow

| # | Test | What it would prove |
|---|---|---|
| 13 | If inside case body | Combined if+switch CFG lowering |
| 14 | Switch inside if body (then and else) | Combined switch+if CFG lowering |
| 15 | for/while inside case body | Loop-inside-switch; break/continue behavior |
| 16 | Local aggregate in nested block inside case | Nested `lowerBlock` cleanup; `firstCleanup` tracking |
| 17 | switch inside for-loop initializer | Switch as loop body; all frame interactions |
| 18 | Aggregate escaped to callee (function call consumes it) | `deactivateAggregateOwner` via callee summary path |

### P3 — Error diagnostics

| # | Test | What it would prove |
|---|---|---|
| 19 | Non-number switch expression → error | Diagnostic message verified |
| 20 | Non-number case expression → error | Diagnostic message verified |
| 21 | Duplicate default → error | Diagnostic message verified |
| 22 | Case after default → error | Diagnostic message verified |
| 23 | `break` outside switch/loop → error | Diagnostic message verified |
| 24 | `continue` outside loop → error inside switch case | Diagnostic message verified |
