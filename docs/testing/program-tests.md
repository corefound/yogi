# Program Tests

Program Tests are end-to-end programs written in Yogi.

They do not replace unit tests or focused runtime pipeline tests. They protect a
different layer: the way language features behave when they are used together in
programs that look like real user code.

## Purpose

Unit and focused pipeline tests answer questions like:

```txt
Does this one semantic rule work?
Does this diagnostic fire?
Does this runtime function handle this edge case?
```

Program Tests answer a broader question:

```txt
Can a real Yogi program compile, lower to LLVM, link, run, and produce the
expected result when multiple language systems interact?
```

## Program Observability Direction

The current Program Test system validates artifacts, execution, visible output,
selected LLVM symbols, native resource counters, and sanitizers. The next
generation must also reconstruct the internal history that produced the result:

```txt
frontend decisions
SIR contracts
lowering choices
LLVM structure
runtime ownership and borrows
memory and resource lifetime
cleanup on every control-flow path
```

The concrete architecture, event model, expectation format, invariants, and
staged migration plan are documented in:

```txt
docs/testing/program-observability-architecture.md
```

Implementation tracking lives in:

```txt
docs/todo/program-observability.md
```

Existing `.cmake` Program Tests remain valid during the migration. They should
move incrementally to the shared manifest/runner instead of being rewritten all
at once.

Stages 1 through 4 are implemented. Every Program Test registered through
`add_yogi_program_test` is executed by:

```txt
tests/programs/runner/runProgramTest.cmake
```

The wrapper is exclusive to Program Tests. Focused pipeline tests keep their
existing direct CMake execution.

Each Program Test produces:

```txt
build/tests/<program-name>.observability/
  manifest.json
  harness.events.jsonl
  runtime-<process-id>.events.jsonl
  summary.json
  anomalies.json
  timeline.txt
```

The default profile validates event envelopes, monotonic producer sequences,
allocation/reallocation/free history, aggregate lifetime, frame balance,
external resources, and sanitizer diagnostics. Tests may add a surgical
manifest under:

```txt
tests/programs/manifests/<program-name>.json
```

The first surgical manifest follows all 33 native resources through creation
and destruction:

```txt
tests/programs/manifests/native_resource_array_pointer_policy.json
```

Known survivor allowances are explicit category/type entries with a reason.
They are migration debt, not successful cleanup, and are tracked in
`docs/todo/program-observability.md`.

Stage 2 adds semantic decision expectations. A surgical manifest can require a
specific compiler decision to appear at each phase:

```json
{
  "kind": "decision",
  "decisionKind": "Move",
  "decisionReason": "ReturnTransfersToCaller",
  "plannedAtLeast": 1,
  "loweredAtLeast": 1,
  "runtimeAtLeast": 1
}
```

The analyzer correlates the same `decisionId` through:

```txt
frontend semantic.decision.plan
SIR sir.decision.read
backend lowering.decision.consume
runtime semantic.decision.execute
```

Do not require runtime execution universally: a valid decision can belong to a
branch or function that the test does not execute. Use `runtimeAtLeast` only
when the program deliberately executes that path.

Stage 4 completes the structural reducer core. Runtime events now correlate:

```txt
semantic decision -> frame
cleanup activation -> owner/frame/generation
cleanup cancel, execute, replacement rearm, or null skip -> terminal transition
cleanup execute -> normal/return/break/continue lowering path
frame enter -> parent frame
frame exit -> normal or return
```

Cleanup expectations can require runtime executions by exit reason:

```json
{
  "kind": "cleanup",
  "owner": "ticket",
  "cleanupKind": "struct",
  "runtimeByExit": {
    "normal": 1,
    "return": 1,
    "break": 1,
    "continue": 1
  }
}
```

The analyzer rejects active obligations at frame exit, duplicate cleanup,
cancel/execute without activation, wrong-frame events, non-LIFO frame exits,
and runtime cleanup on a path that lowering did not emit.

`ownership_control_flow_observability` is the surgical Program Test for this
contract. It combines real Yogi control flow with native resources and exact
lifetime counters.

Program Observability is now stable and sufficient for the current language.
Future observability changes belong with the language feature that needs them;
there is no separate structural Stage 5 roadmap.
when the Program Test intentionally exercises that path.

`native_job_ticket_ownership` is the first Stage 2 surgical Program Test. It
proves real copy, automatic resource move on return/assignment/by-value calls,
address-of borrowing, and heap promotion while retaining its native lifetime
counter and sanitizer checks.

Stage 3 adds cleanup obligations:

```json
{
  "kind": "cleanup",
  "owner": "label",
  "cleanupKind": "string",
  "destroyFunction": "yogi_string_destroy",
  "scheduledAtLeast": 1,
  "emittedAtLeast": 1,
  "runtimeAtLeast": 1
}
```

Useful cleanup transitions are:

```txt
cleanup.schedule  lexical owner becomes responsible
cleanup.rearm     assignment installs a new resource in that owner
cleanup.cancel    move/escape removes local cleanup responsibility
cleanup.emit      lowering generated a cleanup site
cleanup.execute   runtime followed that cleanup path
```

Every Program Test now has all generated `.ll` modules parsed and verified
through LLVM APIs. A surgical manifest can add structural assertions:

```json
{
  "ir": [
    {
      "kind": "call",
      "file": "packages/.cache/modules/main.ts/main.ll",
      "function": "_yogi_fn_main_ts_run",
      "callee": "yogi_observe_cleanup",
      "atLeast": 1,
      "metadata": [
        "yogi.cleanup",
        "yogi.owner",
        "yogi.destroy"
      ]
    },
    {
      "kind": "namedMetadata",
      "file": "packages/.cache/modules/main.ts/main.ll",
      "name": "yogi.cleanup.obligations",
      "atLeast": 1
    }
  ]
}
```

Supported structural expectation kinds are `function`, `call`, and
`namedMetadata`. Use `exactly` for a fixed count or `atLeast` for a lower
bound. New Program Tests should prefer these assertions over reading LLVM text
with CMake regexes.

## Location

Program Tests live in:

```txt
tests/programs/
```

Each test should:

- write a complete `main.ts` into `TEST_WORK_DIR`
- compile it with `YOGI_EXECUTABLE`
- verify cache artifacts such as `main.ll`, `main.o`, and the final executable
- run the executable
- assert the expected output

## Current Program Tests

| Program | Test | Status | Coverage |
|---|---|---|---|
| Inventory Manager | `tests/programs/inventory_manager.cmake` | Implemented | structs, arrays, struct arrays, functions, `for`, `for...of`, callbacks, mutation, arithmetic, control flow, LLVM/runtime execution |
| Recursive Aggregate Array Copy Report | `tests/programs/recursive_aggregate_array_copy_report.cmake` | Implemented | recursive array/struct value copies, nested owned fields, borrowed materialization, pointer-field identity, alias-safe replacement, strict cleanup observability, LLVM/runtime execution |
| Union and Any Narrowing Report | `tests/programs/union_any_narrowing_report.cmake` | Implemented | tagged union/any values, `typeof` control-flow narrowing, aggregate payload copies, value parameters and returns, global replacement, early return, loop cleanup, strict `allowLive: []`, LLVM/runtime execution |
| Tagged User Cleanup | `tests/programs/tagged_user_cleanup.cmake` | Implemented | `ptr<User[]>` parameters, value and pointer iteration over array pointers, string equality, boolean negation, dynamic array `splice`, struct mutation, `.length`, LLVM/runtime execution |
| Player Scoreboard | `tests/programs/player_scoreboard.cmake` | Implemented | returned pointers into dynamic array cells, struct field pointer mutation, `push`, value iteration over `ptr<Player[]>`, function calls, LLVM/runtime execution |
| Array Copying Methods | `tests/programs/array_copying_methods.cmake` | Implemented | all JavaScript copy-producing array methods currently exposed by Yogi, source preservation, ordering/depth/callback semantics, LLVM/runtime execution |
| Matrix Report | `tests/programs/matrix_report.cmake` | Implemented | fixed-shape matrix row views, returned/materialized views, global view retention, value-parameter isolation, LLVM/runtime execution |
| Fixed Matrix Iteration Report | `tests/programs/fixed_matrix_iteration_report.cmake` | Implemented | fixed-shape aliases, function-return matrices, nested row/value iteration, row mutation, normal/continue/break/return cleanup, logical dimensions through pointers, strict observability, LLVM/runtime execution |
| Array Expression Lifetime Report | `tests/programs/array_expression_lifetime_report.cmake` | Implemented | anonymous dynamic/fixed array arguments, owned method chains, spreads, callback copies, extraction cleanup, boxed pointer arrays, early return, continue/break, stress loops, strict `allowLive: []`, LLVM/runtime execution |
| Array Scalar Receiver Lifetime Report | `tests/programs/array_scalar_receiver_lifetime_report.cmake` | Implemented | temporary scalar/element/string-returning array methods, callback chains, union search-box lifetime, borrowed `ptr<T[]>` receivers, early return/continue, LLVM cleanup inspection, sanitizer integration, and strict `allowLive: []` |
| Array Reduce Aggregate Report | `tests/programs/array_reduce_aggregate_report.cmake` | Implemented | independent reduce seeds, array/string/object accumulators, named callback value parameters, reduceRight, temporary receivers, loop control flow, LLVM ownership calls, sanitizer integration, and strict `allowLive: []` |
| Managed Struct Reduce Report | `tests/programs/managed_struct_reduce_report.cmake` | Implemented | copyable managed struct accumulators, nested field ownership, fresh replacement on early return, named and inline callbacks, reduceRight tuple receiver typing, by-value struct isolation, cleanup reducers, sanitizer integration, and strict `allowLive: []` |
| Inline Reduce Branch Ownership Report | `tests/programs/inline_reduce_branch_ownership_report.cmake` | Implemented | inline managed struct locals, nested conditional owner selection, seed isolation, local cleanup slots, by-value inspection, early return, branch-aware LLVM checks, sanitizer integration, and strict `allowLive: []` |
| Inline Reduce Control Flow Report | `tests/programs/inline_reduce_control_flow_report.cmake` | Implemented | nested inline blocks, `if/else`, multiple early returns, branch-local managed owners, shared callback exits, seed isolation, by-value inspection, LLVM CFG checks, sanitizer integration, and strict `allowLive: []` |
| Inline Callback Loop and Switch Report | `tests/programs/inline_callback_loop_switch_report.cmake` | Implemented | inline `while`, `for`, `switch`, fall-through, nearest-frame `break`/`continue`, managed locals on direct case entry, early return, LLVM CFG checks, sanitizer integration, and strict `allowLive: []` |
| Dynamic Array Borrow Archive | `tests/programs/dynamic_array_borrow_archive.cmake` | Implemented | local dynamic-array borrows from `ptr<T[]>`, direct/aliased forwarding, replacement semantics, owned snapshots, discarded results, early return, continue/break stress, strict `allowLive: []`, LLVM/runtime execution |
| Array Value Assignment Report | `tests/programs/array_value_assignment_report.cmake` | Implemented | source-preserving array assignment, independent destinations, mutable pointer-derived views, owned return materialization, value parameters, target-slot stability, loop stress, defined rejection for unsupported aggregate-element copies, strict `allowLive: []`, LLVM/runtime execution |
| Sales Destructuring Report | `tests/programs/sales_destructuring_report.cmake` | Implemented | array destructuring, rest bindings, tuple-rest annotations, `entries()` destructuring, structs, function calls, LLVM/runtime execution |
| Array Storage Policy Report | `tests/programs/array_storage_policy_report.cmake` | Implemented | contiguous vs pointer-safe array storage, live interior pointers, fixed-shape indexing, functions, LLVM/runtime execution |
| Native Signal Processor | `tests/programs/native_signal_processor.cmake` | Implemented | extern native numeric array ABI, temporary contiguous buffers, mutable copy-back through `ptr<number[]>`, fixed-shape matrix dimensions, static native library linking, LLVM/runtime execution |
| Native Reading Calibrator | `tests/programs/native_reading_calibrator.cmake` | Implemented | extern native plain numeric struct array ABI, `Struct* + length` marshalling, mutable copy-back through `ptr<Struct[]>`, static native library linking, LLVM/runtime execution |
| Native Dictionary Lookup | `tests/programs/native_dictionary_lookup.cmake` | Implemented | extern native `string[]` ABI, temporary `const char** + length` marshalling, native lookup, original array preservation, static native library linking, LLVM/runtime execution |
| Native Owned Name | `tests/programs/native_owned_name.cmake` | Implemented | extern native `string` return with `@abi return native-owned free=...`, native free invocation, LLVM/runtime execution |
| Native Owned Name Output | `tests/programs/native_owned_name_output.cmake` | Implemented | extern native `ptr<string>` output parameter with `@abi param name output native-owned free=...`, temporary `char**` output slot, native free invocation, pointer write-back, LLVM/runtime execution |
| Native Runtime Owned Name | `tests/programs/native_runtime_owned_name.cmake` | Implemented | extern native `string` return and `ptr<string>` output parameter with runtime-owned contracts, runtime string validation/adoption, LLVM/runtime execution |
| Native Extern Destructor C | `tests/programs/native_extern_destructor_c.cmake` | Implemented | native resource RAII through `destructor(resource: ptr<void>): void`, normal cleanup, early return cleanup, reverse order, reassignment, return transfer, null skip, LLVM/runtime execution |
| Native Extern Destructor C++ | `tests/programs/native_extern_destructor_cpp.cmake` | Implemented | native resource created with C++ `new` and destroyed with `delete` through extern destructor RAII |
| Native Resource Struct Fields | `tests/programs/native_resource_struct_fields.cmake` | Implemented | native resources moved into real struct fields, nested field cleanup, field reassignment cleanup, no double destruction, LLVM/runtime execution |
| Native Job Ticket Ownership | `tests/programs/native_job_ticket_ownership.cmake` | Implemented | extern native resources, native-owned string returns, automatic resource-owning struct transfer through assignment, return, and by-value calls, native destructor RAII, LLVM/runtime execution |
| Native Resource Array Ownership | `tests/programs/native_resource_array_ownership.cmake` | Implemented | arrays that own resource-carrying structs, insertion/extraction transfer, safe `map` to copyable values, shallow-copy rejection, exact destructor counts, no double destruction, LLVM/runtime execution |
| Native Resource Array Function Boundaries | `tests/programs/native_resource_array_function_boundaries.cmake` | Implemented | owned and forwarded array returns, `ptr<T[]>` borrows, discarded results, early return, loops, `break`, `continue`, stress allocation, exact destructor counts, LLVM artifacts, optional ASan/LSan/UBSan execution |
| Native Resource Array Pointer Policy | `tests/programs/native_resource_array_pointer_policy.cmake` | Implemented | descriptor-owned element policy across three modules, `ptr<T[]>` structural operations, nested aggregates, chained returns, discarded results, reallocation stress, exact native lifetime counters, every module's LLVM/object artifacts, and optional ASan/LSan/UBSan execution |
| Native Extern Destructor Missing Symbol | `tests/programs/native_extern_destructor_missing_symbol.cmake` | Implemented | negative link test for a declared extern destructor whose native symbol is missing |

## Memory Safety Contract

For programs that own resources, checking stdout is necessary but insufficient.
The fixture should also expose counters or assertions that prove:

- every created resource is destroyed exactly once
- no resource remains live after its expected lifetime
- discarded owned values are cleaned automatically
- ownership transfer suppresses cleanup in the old owner
- cleanup runs on normal exit, early `return`, loop exit, `break`, and `continue`
- stderr contains no Yogi ownership error or sanitizer diagnostic

Stress scenarios should create enough resources and control-flow variation to
exercise metadata growth and destructor scheduling, rather than validating only
one happy-path allocation.

## Sanitizer Builds

Configure a separate build directory so sanitizer artifacts do not mix with the
normal build:

```sh
cmake -S . -B build-sanitized -G Ninja \
  -DCMAKE_BUILD_TYPE=Debug \
  -DYOGI_ALLOCATOR=system \
  -DYOGI_ENABLE_SANITIZERS=ON
cmake --build build-sanitized
ctest --test-dir build-sanitized -R yogi_program_ --output-on-failure
```

This instruments the compiler/runtime and native C fixtures with AddressSanitizer
and UndefinedBehaviorSanitizer. Leak detection is enabled through ASan on
platforms that provide it. AppleClang's macOS runtime does not provide LeakSanitizer,
so macOS runs ASan/UBSan plus exact resource counters; Linux additionally enables
leak detection.

Generated Yogi executables are linked with the sanitizer runtimes selected by
the configured compiler. The normal build remains unchanged when
`YOGI_ENABLE_SANITIZERS=OFF`.

## Rules

Program Tests must use only language features that Yogi currently supports.

They should not introduce future syntax just because TypeScript supports it.
Yogi is TypeScript-like syntactically, but strict and RAII-oriented
semantically.

Good Program Tests feel like small applications:

- inventory manager
- contact manager
- matrix operations
- graph traversal
- expression evaluator
- scheduler

Focused feature tests still belong in `tests/runtime/sessions/`.

## Growth Policy

Every major language feature should eventually appear inside at least one
Program Test when it can be used naturally.

Examples:

- new pointer behavior should appear in a program that benefits from pointers
- new array behavior should appear in a program using realistic collection logic
- new struct/data-type behavior should appear in a real custom data model
- new control-flow behavior should appear inside an algorithm

Program Tests should grow with the language instead of staying as tiny examples.
They do not need to wait for an entire feature family to be finished; add one
when the implemented subset can form a coherent program that a user might
actually write.
