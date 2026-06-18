# Runtime Test Organization

Runtime and pipeline tests are grouped by implementation responsibility. New
tests should land near the behavior they protect instead of going into a single
flat file.

## Current Layout

```txt
tests/runtime/unit/
tests/runtime/sessions/01-runtime/
tests/runtime/sessions/02-variables-aggregates/
tests/runtime/sessions/03-memory-management/
tests/runtime/sessions/04-control-flow/
```

## Folder Responsibilities

| Folder | Purpose | Examples |
|---|---|---|
| `tests/runtime/unit/` | Direct C++ runtime unit tests | cast behavior, ownership debug aborts |
| `tests/runtime/sessions/01-runtime/` | Runtime ABI and basic runtime behavior | `runtime_any.cmake` |
| `tests/runtime/sessions/02-variables-aggregates/` | Variables and aggregate value behavior | arrays, tuples, objects, dynamic expressions |
| `tests/runtime/sessions/03-memory-management/` | Escape analysis, ownership, move state, cleanup | function ownership, destructor scheduling, aggregate assignment ownership |
| `tests/runtime/sessions/04-control-flow/` | Control-flow semantics and lowering | loops, break/continue, switch/case/default |

## Placement Rules

Variable and aggregate value tests belong in:

```txt
tests/runtime/sessions/02-variables-aggregates/
```

Examples:

- `aggregates.cmake`
- `array_methods.cmake`
- `array_copy_splice_methods.cmake`
- `array_with_range.cmake`
- `array_named_callbacks.cmake`
- `dynamic_expressions.cmake`

Memory ownership tests belong in:

```txt
tests/runtime/sessions/03-memory-management/
```

Examples:

- `function_ownership.cmake`
- `destructor_scheduling.cmake`
- `move_state_validation.cmake`
- `aggregate_assignment_ownership.cmake`

Switch/control-flow tests belong in:

```txt
tests/runtime/sessions/04-control-flow/
```

Examples:

- `switch.cmake`
- `switch_ownership.cmake`
- `switch_definite_assignment.cmake`
- `break.cmake`
- `loops_and_methods.cmake`

If a test mixes memory and control flow, choose the folder by the primary
question being protected:

- "Does `switch` fall through like TypeScript?" -> `04-control-flow`
- "Does an aggregate escape safely through assignment inside a switch?" ->
  `03-memory-management`

## CTest Naming

Use names that match the behavior, not only the syntax surface.

Good:

```txt
yogi_pipeline_aggregate_assignment_ownership
yogi_pipeline_switch_definite_assignment
```

Avoid:

```txt
yogi_pipeline_misc
yogi_pipeline_new_test
```

## Runtime Execution Assertions

Pipeline tests should prefer runtime execution assertions when possible. A test
that only checks compilation can miss ownership bugs such as early free,
double-free, invalid free, or stale global values.

For language-level pipeline tests, value assertions currently use a small helper
that deliberately triggers a runtime cast failure when the returned value is not
the expected value. This keeps assertions inside the Yogi program until the
runtime grows a direct test assertion API.

## Generated Artifacts

CTest cases should write generated source files, cache folders, IR, object files,
and executables under the provided `TEST_WORK_DIR`. Avoid writing test artifacts
into source folders.
