# Lot 90: Program Observability Stage 1

## Goal

Turn every Yogi Program Test into a structured runtime lifetime audit without
changing focused pipeline tests or requiring full-trace snapshots.

## Implemented

```txt
YOGI_ENABLE_PROGRAM_OBSERVABILITY=OFF by default
shared Program Test runner
versioned generated and surgical manifests
build-local trace sessions
JSONL runtime events
monotonic allocation IDs
reallocation generations
frame, aggregate, and external-resource IDs
runtime state reducer
universal lifetime invariants
count expectations
summary, anomalies, and timeline artifacts
sanitizer/ownership diagnostic adapter
```

Every existing `add_yogi_program_test` registration now uses the shared runner.
The individual scripts continue to own their source fixtures, native fixtures,
artifact assertions, output assertions, and negative compiler assertions.

## Runtime History

Example:

```txt
memory.allocate allocation:742:11 generation=1
memory.reallocate allocation:742:11 generation=2
memory.free allocation:742:11 generation=2
```

An allocator may reuse the same address later, but the next allocation receives
a new ID. The analyzer rejects reuse of an ended allocation identity.

## First Surgical Program

`native-resource-array-pointer-policy` emits native resource events from its C
fixture:

```c
yogi_observe_resource_create(job, "NativeJob");
yogi_observe_resource_destroy(job, "NativeJob");
```

Its manifest requires:

```txt
resource.create = 33
resource.destroy = 33
no invalid transition
no active frame
no unexpected live resource
no dropped event
clean sanitizer/runtime diagnostics
```

## Deep Error Found

The first strict run failed even though stdout and the native counters were
correct. The trace found surviving boxed objects, property tables/keys, array
temporaries, views, and projected pointer cells.

The new contract lists those survivors explicitly by category and type. This
keeps the Program Test suite usable while preserving the evidence that cleanup
is incomplete. Any survivor outside that finite list fails immediately.

The instrumentation also found that heap arrays were briefly reported as both
stack and heap aggregates because `ArrayValue::create()` called the public
stack initializer. Heap creation now initializes storage without publishing a
false stack lifetime.

## Validation

```txt
yogi_program_trace_analyzer_test
yogi_runtime_program_observability_test
all registered yogi_program_* tests
```

The analyzer self-test includes:

```txt
valid realloc generation transition
valid allocator address reuse with a new allocation ID
invalid allocation ID resurrection
first-divergence anomaly output
```

A separate `BUILD_TESTING=OFF`,
`YOGI_ENABLE_PROGRAM_OBSERVABILITY=OFF` build was also inspected. The final
`yogi` executable contains no `ProgramObservability`,
`yogi_program_observability_*`, or `yogi_observe_resource_*` symbols.

## Next

Stage 2 should add deterministic frontend/SIR identities and typed semantic
decision events. In parallel, dedicated cleanup lots should reduce the explicit
Stage 1 survivor list, starting with boxed `AnyValue`/struct elements because
they account for the largest hidden lifetime debt.
