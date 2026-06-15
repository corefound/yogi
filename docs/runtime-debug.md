# Runtime Debug Ownership

This document tracks the runtime debug/tooling lot for Yogi's memory model.

The language goal is still C++/RAII-like, not Rust-like:

```text
compiler:
  owns escape analysis, ownership summaries, destructor scheduling

runtime debug mode:
  detects when compiler/runtime ownership invariants are violated
```

Debug mode does not add a borrow checker. It adds runtime metadata and checks so
that ownership bugs fail with clear diagnostics instead of silent corruption.

## Current Scope

This lot adds `YOGI_RUNTIME_DEBUG_OWNERSHIP`, enabled by default in the runtime
CMake configuration for now.

The tracker records:

- Raw allocations created by `yogi_alloc`.
- Reallocations through `yogi_realloc`.
- Frees through `yogi_free`.
- Heap aggregate descriptors created by `yogi_array_create` and
  `yogi_object_create`.
- Stack aggregate descriptors initialized by `yogi_array_init` and
  `yogi_object_init`.
- Aggregate cleanup through `yogi_array_drop`, `yogi_object_drop`,
  `yogi_array_destroy`, and `yogi_object_destroy`.
- The module, function, source path, line, and column active when a resource is
  created.
- The module, function, source path, line, and column active during the last
  ownership event for that resource.

The tracker intentionally uses a small C-style table instead of STL containers.
Generated Yogi executables are linked directly with LLD and the runtime archive,
so the debug implementation must not pull in extra C++ runtime symbols.

## Public Debug ABI

The runtime exposes a small C ABI:

```c
bool yogi_debug_ownership_enabled(void);
unsigned long long yogi_debug_ownership_live_allocations(void);
unsigned long long yogi_debug_ownership_live_aggregates(void);
unsigned long long yogi_debug_ownership_report_leaks(void);
void yogi_debug_ownership_reset(void);
```

These are debug/tooling hooks. Generated user code does not need to call them.
Tests and future tooling can use them to inspect runtime state.

Memory volume counters live in a separate telemetry layer. See
[Runtime Memory Telemetry](runtime-memory-telemetry.md) for live bytes, total
allocated/freed bytes, peak memory, and the compact debug report ABI.

## Double Free

```c
void *value = yogi_alloc(8);
yogi_free(value);
yogi_free(value);
```

The second free fails before the allocator is called:

```text
yogi runtime ownership error: double free at <address> (raw allocation)
  created: module=main_io function=main_io_run source=main.io:4:9
  last-event: module=main_io function=main_io_run source=main.io:5:5
  detected: module=main_io function=main_io_run source=main.io:6:5
```

This protects the runtime from allocator-level corruption and points at the
ownership violation directly. `created` identifies where the runtime first saw
the resource. `last-event` identifies the most recent successful ownership
operation. `detected` identifies where the invalid operation was attempted.

## Invalid Free

```c
int local = 7;
yogi_free(&local);
```

The tracker has no allocation record for `&local`, so it aborts with:

```text
yogi runtime ownership error: invalid free at <address>
  created: module=main_io function=main_io_run source=main.io:9:5
  last-event: module=main_io function=main_io_run source=main.io:9:5
  detected: module=main_io function=main_io_run source=main.io:9:5
```

This catches freeing stack memory, foreign pointers, or pointers that did not
come from the Yogi runtime allocator.

## Aggregate Drop vs Destroy

Stack aggregate descriptors use `drop`:

```text
yogi_array_init(stackAddress, length)
...
yogi_array_drop(stackAddress)
```

Heap aggregate descriptors use `destroy`:

```text
array = yogi_array_create(length)
...
yogi_array_destroy(array)
```

Debug mode validates that the operation matches the descriptor ownership:

- Dropping a heap descriptor is an error.
- Destroying a stack descriptor is an error.
- Dropping or destroying the same descriptor twice is an error.

This mirrors the compiler model:

```text
stack descriptor:
  cleanup internal runtime buffers, but do not free descriptor memory

heap descriptor:
  cleanup internal runtime buffers, then free descriptor memory
```

## Use After Destroy

```c
void *array = yogi_array_create(1);
yogi_array_destroy(array);
yogi_array_get(array, 0);
```

The access fails because the aggregate record exists but is no longer alive.
The error includes the original aggregate creation location plus the current
access location:

```text
yogi runtime ownership error: array get after destroy/drop at <address> (array value)
  created: module=main_io function=main_io_run source=main.io:2:28
  last-event: module=main_io function=main_io_run source=main.io:3:5
  detected: module=main_io function=main_io_run source=main.io:4:18
```

This is the runtime side of the rule:

```text
Never use values that were moved, escaped into another owner and destroyed, or
already cleaned up.
```

The current check covers aggregate descriptor access after drop/destroy. Future
lots can extend this to richer resource handles and compile-time move-state
diagnostics.

## Leak Report

```c
(void) yogi_array_create(1);
yogi_debug_ownership_report_leaks();
```

The report prints live allocations and live aggregate descriptors:

```text
yogi runtime ownership leak: <address> (array value) allocation-live aggregate-live
  created: module=main_io function=main_io_run source=main.io:2:28
  last-event: module=main_io function=main_io_run source=main.io:2:28
```

For now leak reporting is explicit. It does not automatically fail every program
at exit, because the runtime still has intentionally long-lived values such as
boxed `any` values.

The leak output intentionally uses the same source-location vocabulary as memory
telemetry:

```text
created:
  where this record first became owned by the runtime

last-event:
  where the latest successful ownership operation happened
```

This makes leak reports useful for compiler/runtime development without adding a
garbage collector or a Rust-style borrow checker.

## Test Coverage

The runtime tests cover:

- Debug mode enabled.
- Allocation/reallocation/free counters.
- Aggregate live counters.
- Double free abort.
- Invalid free abort.
- Double destroy abort.
- Use after destroy abort.
- Explicit leak report.
- Source-aware ownership diagnostics for negative cases.
- Source-aware leak reports.

Pipeline tests also run with debug ownership enabled, which means generated LLVM
continues to link and execute with the tracker present.

## Remaining Work

Future runtime-debug lots should add:

- Module-aware leak reports at process exit.
- Ownership event tracing.
- Move-state diagnostics such as use-after-move with source spans.
- Per-resource destructors once user-defined resource types exist.
