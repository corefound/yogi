# Aggregate Assignment Ownership Audit

> Last updated: 2026-07-28
>
> Runtime suite: `tests/runtime/sessions/03-memory-management/aggregate_assignment_ownership.cmake`
>
> CTest name: `yogi_pipeline_aggregate_assignment_ownership`

This audit tracks the general aggregate assignment path:

```ts
target = source
```

The focus is plain identifier assignment such as `saved = scores`, where `saved`
is module/global storage and `scores` is a local aggregate owner. This is not a
switch-specific audit, though switch scenarios are included as control-flow
coverage.

## Coverage Table

| Feature / Case | Status | Test Exists? | Notes |
|---|---|---|---|
| normal function `saved = scores` | ✅ supported and tested | ✅ | `normal_function_local_to_global`; target receives a copy and `main()` returns `1` |
| nested block `saved = scores` | ✅ supported and tested | ✅ | `nested_block_local_to_global`; target copy survives nested cleanup |
| if branch escape | ✅ supported and tested | ✅ | `if_branch_local_to_global`; true path remains valid |
| else branch escape | ✅ supported and tested | ✅ | `else_branch_local_to_global`; false path remains valid |
| pre-branch aggregate escapes inside branch | ✅ supported and tested | ✅ | `pre_branch_local_to_global`; merge preserves deactivation on escaping path |
| while loop body escape | ✅ supported and tested | ✅ | `while_loop_local_to_global`; loop cleanup does not drop escaped owner |
| for loop body escape | ✅ supported and tested | ✅ | `for_loop_local_to_global`; same behavior as while |
| switch case escape | ✅ supported and tested | ✅ | `switch_case_local_to_global`; break cleanup skips escaped owner |
| pre-switch aggregate escapes inside case | ✅ supported and tested | ✅ | `pre_switch_local_to_global`; switch end does not reactivate cleanup |
| fall-through switch escape | ✅ supported and tested | ✅ | `fallthrough_switch_local_to_global`; literal entry proves case 1 initializes before case 2 |
| alias chain local -> alias -> global | ✅ supported and tested | ✅ | `alias_chain_local_to_global`; each normal assignment keeps value semantics |
| returned aggregate assigned to global | ✅ supported and tested | ✅ | `returned_aggregate_to_global`; return move then global store |
| dynamic array global reassignment/replacement | ✅ supported and tested | ✅ | `global_reassignment_replaces_previous`; IR contains the temporary-only `yogi_array_move_replace_from` path |
| unsafe fall-through assignment | ✅ supported and tested | ✅ negative | `uninitialized_fallthrough_assignment`; semantic diagnostic before LLVM |
| unsafe fall-through return | ✅ supported and tested | ✅ negative | `uninitialized_fallthrough_return`; semantic diagnostic before LLVM |
| unsafe fall-through element read | ✅ supported and tested | ✅ negative | `uninitialized_fallthrough_read`; semantic diagnostic before LLVM |
| unsafe fall-through scalar read | ✅ supported and tested | ✅ negative | `uninitialized_fallthrough_scalar`; same rule for primitives |
| duplicate case binding without explicit block | ✅ supported and tested | ✅ negative | `duplicate_case_binding_without_block`; shared switch scope |
| same names with explicit case blocks | ✅ supported and tested | ✅ | `explicit_block_case_scopes`; explicit blocks isolate names |
| empty case grouping | ✅ supported and tested | ✅ | `empty_case_grouping`; 1/2/3 group to same body |
| aggregate declared in earlier case but never used on direct-entry path | ✅ supported and tested | ✅ | `unused_earlier_case_aggregate`; cleanupSlot skips uninitialized cleanup |
| branch-specific cleanup precision for non-escaping alternate path | ⚠️ partially supported / needs review | ❌ | Current merge is conservative and may over-extend lifetime |
| property/index aggregate retention | ⚠️ partially supported / needs review | ❌ | Related path is `lowerAggregateAssignment`, outside this lot |

## Bug Found

The original local-to-global assignment path deactivated the RHS owner:

```ts
saved = scores
```

That behavior was later corrected: normal `=` has value semantics and must not
deactivate or empty a named RHS. The compiler materializes a copy before target
replacement. Global reassignment also had to preserve the previous target
descriptor while replacing its values:

```ts
saved = first
saved = second
```

That could leak the previous global-owned aggregate. For non-dynamic aggregate
replacement, the backend loads the old global value, checks that it is non-null
and different from the new pointer, emits the aggregate destructor, then stores
the replacement.

Dynamic arrays now have a precise two-step rule: copy the observable RHS, then
call `yogi_array_move_replace_from` on that compiler-created temporary. The
target descriptor is kept, common slots are overwritten, new slots are created,
and removed slots are invalidated. The named or borrowed source remains intact.

## Semantic Safety

The suite also verifies that unsafe fall-through references fail during semantic
analysis:

```ts
switch (x) {
    case 1:
        let scores: number[] = [1, 2, 3]

    case 2:
        saved = scores
        break
}
```

If `x == 2`, execution can enter `case 2` directly. `scores` is visible because
the switch body has a shared TypeScript-like scope, but it is not definitely
initialized. The compiler rejects this before LLVM generation.

## Runtime And IR Checks

The suite checks that every passing scenario:

- compiles successfully
- produces an executable in the local test cache
- produces `main.ll` and `main.o`
- runs the executable successfully
- asserts the returned value through runtime execution
- contains aggregate runtime symbols such as `yogi_array_create`,
  `yogi_array_get`, `yogi_array_destroy`, `yogi_memory_push_context`, and
  `yogi_memory_pop_context`

The dynamic-array global replacement scenario additionally checks that the
generated IR contains `yogi_array_move_replace_from`, proving the
slot-preserving path consumes only a compiler-created temporary.

LLVM verification is still performed by the backend before writing the IR and
object file.

## Current Verdict

`saved = scores` safely updates global/module dynamic-array storage from an
independent owned copy. `scores` remains valid and unchanged. Target slot
replacement is tested outside switch and inside switch.
