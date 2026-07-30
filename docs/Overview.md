# Yogi Overview

This file tracks the high-level shape of the language and the real programs
used to validate it.

Use the focused TODO files for feature-level details. Use this overview to see
which complete programs exist today and which programs are waiting for more
language support.

## Test Categories

| Category | Location | Purpose |
|---|---|---|
| Unit tests | `tests/runtime/unit/` and compiler Jest tests | Validate focused runtime/compiler behavior |
| Focused pipeline tests | `tests/runtime/sessions/` | Validate one language area or semantic rule end to end |
| Program Tests | `tests/programs/` | Validate complete Yogi programs that combine multiple features |
| Program Observability RFC | `docs/testing/program-observability-architecture.md` | Defines structured cross-phase events, stable identities, invariants, surgical expectations, LLVM inspection, and the migration plan for deeper Program Tests |
| Program Observability Stage 1 | `tests/programs/runner/` | Implemented shared Program Test sessions, runtime lifetime events, stable allocation generations, anomaly analysis, timelines, and surgical manifests |
| Program Observability Stage 2 | `src/compiler/src/observability/` and SIR/lowering/runtime producers | Implements deterministic semantic identities and correlated copy/move/borrow/escape/storage/materialization/promotion decisions from frontend planning through runtime execution |
| Program Observability Stage 3 | `tests/programs/runner/llvm/` and cleanup lowering/runtime producers | Implements stable cleanup obligations, schedule/cancel/emit/execute correlation, LLVM metadata, automatic module verification, and structural IR expectations |
| Program Observability Stage 4 | `tests/programs/runner/programTraceAnalyzer.cpp` | Completes owner, bounded borrow, LIFO frame, and dynamic cleanup reducers with normal/return/break/continue correlation; this is the stable endpoint for observability-only structural work |

## Existing Program Tests

| Program | File | Status | Notes |
|---|---|---|---|
| Inventory Manager | `tests/programs/inventory_manager.cmake` | Implemented | Exercises structs, dynamic arrays, array callbacks, loops, mutation, functions, arithmetic, control flow, LLVM lowering, object generation, linking, and runtime execution |
| Tagged User Cleanup | `tests/programs/tagged_user_cleanup.cmake` | Implemented | Exercises `ptr<User[]>` parameters, pointer/value `for...of` iteration, string tags, struct mutation, `splice`, `.length` on pointer arrays, LLVM lowering, object generation, linking, and runtime execution |
| Player Scoreboard | `tests/programs/player_scoreboard.cmake` | Implemented | Exercises functions returning pointers into dynamic array struct fields, pointer mutation, `push`, pointer-array iteration, LLVM lowering, object generation, linking, and runtime execution |
| Array Copying Methods | `tests/programs/array_copying_methods.cmake` | Implemented | Exercises `slice`, `concat`, `toSpliced`, `toReversed`, `toSorted`, `flat`, `with`, `map`, `filter`, and `flatMap`, verifies source preservation, LLVM IR, object generation, linking, and runtime behavior |
| Matrix Report | `tests/programs/matrix_report.cmake` | Implemented | Exercises fixed-shape matrix row views, returned/materialized views, value-parameter isolation, global view retention, LLVM lowering, object generation, linking, and runtime execution |
| Fixed Matrix Iteration Report | `tests/programs/fixed_matrix_iteration_report.cmake` | Implemented | Exercises fixed-shape aliases, function-return matrices, nested row views, mutation, `continue`, `break`, early return, pointer dimensions, LLVM artifacts, and strict cleanup observability |
| Array Expression Lifetime Report | `tests/programs/array_expression_lifetime_report.cmake` | Implemented | Exercises anonymous array/matrix arguments, copy chains, spreads, callbacks, extraction, boxed pointer arrays, early return, `continue`, `break`, stress allocation, strict LLVM checks, and zero allowed live entities |
| Array Scalar Receiver Lifetime Report | `tests/programs/array_scalar_receiver_lifetime_report.cmake` | Implemented | Exercises temporary scalar/element/string-returning methods, callback chains, short-circuit paths, union search values, borrowed `ptr<T[]>` views, early return, `continue`, LLVM cleanup calls, and strict zero-live observability |
| Array Reduce Aggregate Report | `tests/programs/array_reduce_aggregate_report.cmake` | Implemented | Exercises owned array, string, and object accumulators, seed independence, named callbacks, `reduceRight`, temporary receivers, loops, `continue`, `break`, early return, LLVM clone/destroy calls, and strict `allowLive: []` observability |
| Managed Struct Reduce Report | `tests/programs/managed_struct_reduce_report.cmake` | Implemented | Exercises nested arrays, strings, objects, and structs inside reduce accumulators; named and inline callbacks; fresh replacement on early return; reduceRight over a tuple literal; by-value inspection; loops; LLVM field cleanup; and strict `allowLive: []` observability |
| Inline Reduce Branch Ownership Report | `tests/programs/inline_reduce_branch_ownership_report.cmake` | Implemented | Exercises inline managed struct locals, nested ternary selection between local and fresh owners, seed independence, by-value inspection, early return, loop cleanup, branch-aware LLVM ownership blocks, and strict `allowLive: []` observability |
| Inline Reduce Control Flow Report | `tests/programs/inline_reduce_control_flow_report.cmake` | Implemented | Exercises nested inline blocks, `if/else`, multiple early returns, branch-local managed owners, shared callback exits, seed isolation, by-value inspection, loop cleanup outside callbacks, LLVM CFG checks, and strict `allowLive: []` observability |
| Inline Callback Loop and Switch Report | `tests/programs/inline_callback_loop_switch_report.cmake` | Implemented | Exercises `while`, `for`, `switch`, fall-through, nested `break`/`continue`, early return, managed callback locals, direct case entry, LLVM CFG checks, sanitizer execution, and strict `allowLive: []` observability |
| Dynamic Array Borrow Archive | `tests/programs/dynamic_array_borrow_archive.cmake` | Implemented | Exercises local `ptr<T[]>` aliases, direct and forwarded replacement, owned return materialization, discarded snapshots, early return, loops, `continue`, `break`, LLVM checks, and strict `allowLive: []` observability |
| Array Value Assignment Report | `tests/programs/array_value_assignment_report.cmake` | Implemented | Proves non-destructive `T[] = T[]`, copy materialization from borrowed views, explicit shared mutation through `ptr<T[]>`, preserved target slots, repeated replacement, and strict zero-live ownership |
| Recursive Aggregate Array Copy Report | `tests/programs/recursive_aggregate_array_copy_report.cmake` | Implemented | Proves independent copies of nested arrays, structs containing arrays, nested structs, borrowed-return materialization, value parameters, self/alias assignment, pointer-field identity, control flow, LLVM artifacts, and strict `allowLive: []` observability |
| Union and Any Narrowing Report | `tests/programs/union_any_narrowing_report.cmake` | Implemented | Exercises tagged scalar/aggregate unions, `typeof` narrowing, `any`, concrete and union function arguments, owned returns, global replacement, independent aggregate extraction, loops, early return, `continue`, `break`, LLVM IR, and strict `allowLive: []` observability |
| Sales Destructuring Report | `tests/programs/sales_destructuring_report.cmake` | Implemented | Exercises array destructuring, rest bindings, tuple-rest annotations, `entries()` destructuring, structs, functions, LLVM lowering, object generation, linking, and runtime execution |
| Array Storage Policy Report | `tests/programs/array_storage_policy_report.cmake` | Implemented | Exercises contiguous vs pointer-safe array storage policy, interior pointers, fixed-shape indexing, functions, LLVM IR storage markers, object generation, linking, and runtime execution |
| Native Signal Processor | `tests/programs/native_signal_processor.cmake` | Implemented | Exercises extern native numeric array ABI, temporary contiguous buffers, mutable copy-back through `ptr<number[]>`, fixed-shape matrix ABI dimensions, LLD linking with a static native library, LLVM IR generation, object generation, and runtime execution |
| Native Reading Calibrator | `tests/programs/native_reading_calibrator.cmake` | Implemented | Exercises extern native plain numeric struct array ABI, `Struct* + length` marshalling, mutable copy-back through `ptr<Struct[]>`, static native library linking, LLVM IR generation, object generation, and runtime execution |
| Native Dictionary Lookup | `tests/programs/native_dictionary_lookup.cmake` | Implemented | Exercises extern native `string[]` ABI, temporary `const char** + length` marshalling, native lookup, original array preservation, static native library linking, LLVM IR generation, object generation, and runtime execution |
| Native Owned Name | `tests/programs/native_owned_name.cmake` | Implemented | Exercises `@abi return native-owned free=...` for native `string` returns, automatic copy into Yogi-owned strings, native free invocation, static native library linking, LLVM IR generation, object generation, and runtime execution |
| Native Owned Name Output | `tests/programs/native_owned_name_output.cmake` | Implemented | Exercises `@abi param name output native-owned free=...`, native `char**` output slots, automatic copy into Yogi-owned strings, native free invocation, pointer write-back, LLVM IR generation, object generation, and runtime execution |
| Native Runtime Owned Name | `tests/programs/native_runtime_owned_name.cmake` | Implemented | Exercises `@abi return runtime-owned` and `@abi param name output runtime-owned`, runtime-owned string validation/adoption, native output slots, LLVM IR generation, object generation, and runtime execution |
| Native Extern Destructor C | `tests/programs/native_extern_destructor_c.cmake` | Implemented | Exercises native `destructor(resource: ptr<void>): void`, automatic RAII cleanup, early return, reverse destruction order, reassignment cleanup, return transfer, null cleanup skip, LLVM IR generation, linking, and runtime execution |
| Native Extern Destructor C++ | `tests/programs/native_extern_destructor_cpp.cmake` | Implemented | Exercises native resources created with C++ `new` and cleaned through `delete` in an extern destructor |
| Native Resource Struct Fields | `tests/programs/native_resource_struct_fields.cmake` | Implemented | Exercises native pointer resources moved into real struct fields, nested field ownership, field reassignment cleanup, LLVM IR generation, linking, and runtime execution |
| Native Job Ticket Ownership | `tests/programs/native_job_ticket_ownership.cmake` | Implemented | Exercises extern native resources, native-owned string returns, automatic struct ownership transfer through assignment, return, and by-value calls, native destructor RAII, LLVM IR generation, linking, and runtime execution |
| Ownership Control Flow Observability | `tests/programs/ownership_control_flow_observability.cmake` | Implemented | Exercises native resource owners and borrows across normal exit, early return, loop normal exit, break, and continue while reducers prove frame and cleanup-path correctness |
| Native Resource Array Ownership | `tests/programs/native_resource_array_ownership.cmake` | Implemented | Exercises arrays that own resource-carrying structs, insertion/extraction transfer, safe `map` to copyable values, rejection of shallow-copy methods, exact array-element cleanup, extern destructors, LLVM IR generation, linking, and runtime execution |
| Native Resource Array Function Boundaries | `tests/programs/native_resource_array_function_boundaries.cmake` | Implemented | Exercises owned array returns, forwarded returns, `ptr<T[]>` borrows, discarded owned results, early return, loops, `break`, `continue`, exact destructor counts, LLVM artifacts, and optional sanitizer execution |
| Native Resource Array Pointer Policy | `tests/programs/native_resource_array_pointer_policy.cmake` | Implemented | Exercises descriptor-owned element cleanup across three modules, resource arrays borrowed through `ptr<T[]>`, structural mutation, nested aggregates, returns, discarded results, reallocation stress, exact leak/double-destroy/UAF counters, LLVM IR and objects, final linking, and optional sanitizer execution |
| Native Extern Destructor Missing Symbol | `tests/programs/native_extern_destructor_missing_symbol.cmake` | Implemented | Verifies that declaring an extern destructor without exporting the native symbol fails during linking |

## Planned Program Tests

These should be added only when the language naturally supports the features
they need.

| Program | Status | Waiting On |
|---|---|---|
| Contact Manager | Not implemented | More string/object ergonomics and richer object printing |
| Matrix Operations | Not implemented | More fixed-shape/native matrix lowering and numeric polish |
| Graph Traversal BFS | Not implemented | More nested dynamic-array ownership and queue-like collection behavior |
| Graph Traversal DFS | Not implemented | Same graph data-model support as BFS |
| Dijkstra | Not implemented | Priority queue or comparable collection support |
| Expression Evaluator | Not implemented | More parser-facing string/token utilities |
| CSV Processor | Not implemented | File/string splitting APIs |
| JSON Processor | Not implemented | Object runtime and parser utilities |
| Scheduler | Not implemented | Date/time or richer domain primitives |
| LRU Cache | Not implemented | Map/hash table data structure support |

## Current Language Shape

Yogi currently focuses on:

- strict explicit types
- stack-first ownership and RAII-style cleanup
- structs as real custom data types
- object-like interface/type contracts
- arrays, fixed-shape arrays, callbacks, and iterators
- pointer syntax and pointer provenance
- runtime memory checks
- LLVM lowering and executable generation

The language deliberately does not copy every TypeScript semantic behavior.
Yogi keeps TypeScript-like syntax where useful, but applies stricter compiler
and runtime rules.
