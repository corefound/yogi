# Runtime Memory Telemetry

This document tracks the runtime memory telemetry lot.

The allocator lot made `yogi_alloc`, `yogi_realloc`, and `yogi_free` the only
allocator ABI used by generated LLVM code. This lot adds visibility behind that
ABI so the compiler/runtime can answer simple questions while we continue
building the memory model:

```text
How many runtime allocations are currently alive?
How many bytes are currently alive?
How many bytes have passed through the runtime allocator?
What was the peak live memory?
```

## Runtime ABI

The runtime now exposes:

```c
extern "C" unsigned long long yogi_memory_live_bytes(void);
extern "C" unsigned long long yogi_memory_live_allocations(void);
extern "C" unsigned long long yogi_memory_total_allocated_bytes(void);
extern "C" unsigned long long yogi_memory_total_freed_bytes(void);
extern "C" unsigned long long yogi_memory_peak_bytes(void);
extern "C" void yogi_memory_push_context(const char *moduleName, const char *functionName);
extern "C" void yogi_memory_pop_context(void);
extern "C" const char *yogi_memory_current_module(void);
extern "C" const char *yogi_memory_current_function(void);
extern "C" void yogi_memory_push_source_location(const char *sourcePath, unsigned long long line, unsigned long long column);
extern "C" void yogi_memory_pop_source_location(void);
extern "C" const char *yogi_memory_current_source_path(void);
extern "C" unsigned long long yogi_memory_current_source_line(void);
extern "C" unsigned long long yogi_memory_current_source_column(void);
extern "C" unsigned long long yogi_memory_attributed_live_bytes(const char *moduleName, const char *functionName);
extern "C" unsigned long long yogi_memory_attributed_live_allocations(const char *moduleName, const char *functionName);
extern "C" unsigned long long yogi_memory_attributed_total_allocated_bytes(const char *moduleName, const char *functionName);
extern "C" unsigned long long yogi_memory_attributed_total_freed_bytes(const char *moduleName, const char *functionName);
extern "C" unsigned long long yogi_memory_attributed_peak_bytes(const char *moduleName, const char *functionName);
extern "C" unsigned long long yogi_memory_attributed_location_live_bytes(const char *sourcePath, unsigned long long line, unsigned long long column);
extern "C" unsigned long long yogi_memory_attributed_location_live_allocations(const char *sourcePath, unsigned long long line, unsigned long long column);
extern "C" unsigned long long yogi_memory_attributed_location_total_allocated_bytes(const char *sourcePath, unsigned long long line, unsigned long long column);
extern "C" unsigned long long yogi_memory_attributed_location_total_freed_bytes(const char *sourcePath, unsigned long long line, unsigned long long column);
extern "C" unsigned long long yogi_memory_attributed_location_peak_bytes(const char *sourcePath, unsigned long long line, unsigned long long column);
extern "C" void yogi_memory_debug_report(void);
```

These functions are allocator-independent. They work with:

```text
YOGI_ALLOCATOR=mimalloc
YOGI_ALLOCATOR=jemalloc
YOGI_ALLOCATOR=system
```

The active allocator can still be confirmed with:

```c
extern "C" const char *yogi_allocator_name(void);
```

## What Is Tracked

Telemetry is updated by `MemoryManager`, after the real allocator call succeeds:

```text
yogi_alloc(size)
  -> real allocator allocates memory
  -> ownership debug records allocation
  -> telemetry records live bytes and live allocation count

yogi_realloc(address, newSize)
  -> real allocator resizes memory
  -> ownership debug updates allocation ownership
  -> telemetry removes the old size and records the new size

yogi_free(address)
  -> ownership debug validates the free
  -> telemetry removes the live allocation
  -> real allocator frees memory
```

Telemetry counts bytes requested through the Yogi allocator ABI. A zero-size
allocation is normalized to one byte because the runtime allocator returns a
real non-null allocation for `yogi_alloc(0)`.

The ordering is intentional:

```text
invalid free:
  ownership debug aborts before telemetry changes

failed realloc:
  telemetry is unchanged because it updates only after the allocator succeeds

realloc(nullptr, size):
  behaves like alloc

free(nullptr):
  does not change telemetry

realloc(existing, size):
  live_allocations remains one after the operation completes
```

## Module And Function Attribution

Telemetry now has a context stack:

```c
yogi_memory_push_context("main_io", "main_io_makeScores");
void *scores = yogi_alloc(32);
yogi_memory_pop_context();
```

Allocations made while that context is active are attributed to:

```text
module: main_io
function: main_io_makeScores
type: raw allocation / array elements / object value / any value / ...
```

The backend emits context calls automatically:

```text
module initializer:
  push module, "$module.init"
  ...
  pop

user function:
  push module, qualified function name
  ...
  pop before every return

module cleanup:
  push module, "$module.cleanup"
  ...
  pop
```

The stack shape matters because function calls can be nested. A callee can push
its own context and then pop back to the caller before returning.

Attribution counters can be queried per module/function:

```c
yogi_memory_attributed_live_bytes("main_io", "main_io_makeScores");
yogi_memory_attributed_total_allocated_bytes("main_io", "main_io_makeScores");
```

## Source Location Attribution

This lot adds source location attribution on top of module/function attribution.
It is not required for the memory model to be correct, but it is useful before
the next RAII lots because destructor scheduling, ownership moves, and escaping
aggregates are much easier to debug when an allocation can be traced back to the
line that created it.

The backend emits source-location scope calls around source constructs that can
allocate through the runtime:

```text
variable initializer:
  push source path, line, column
  lower initializer
  pop source location

array/object literal:
  push source path, literal line, literal column
  create/init/populate aggregate
  pop source location

return expression:
  push source path, return line, return column
  lower return value
  pop source location
```

Example source:

```ts
function makeScores(): number[] {
    let scores: number[] = [1, 2, 3]
    return scores
}
```

The array creation happens while both stacks are active:

```text
context stack:
  module: main_io
  function: main_io_makeScores

source stack:
  source: main.io
  line: 2
  column: 28
```

Telemetry records the current module, function, runtime allocation type, source
path, line, and column when `yogi_alloc` or `yogi_realloc` succeeds. Lines and
columns are exposed as one-based values, matching compiler diagnostics. The
location can be queried directly:

```c
yogi_memory_attributed_location_live_bytes("main.io", 2, 28);
yogi_memory_attributed_location_total_allocated_bytes("main.io", 2, 28);
```

Nested source scopes are allowed. If a variable initializer contains an
aggregate literal, the literal location becomes the top of the stack while the
runtime allocation is made, so the report points at the expression that created
the aggregate.

## Example

```cpp
const auto base = yogi_memory_live_bytes();

void *value = yogi_alloc(32);
// live bytes == base + 32

value = yogi_realloc(value, 64);
// live bytes == base + 64
// total allocated bytes increased by 32 + 64
// total freed bytes increased by 32

yogi_free(value);
// live bytes == base
// total freed bytes increased by 32 + 64
```

The peak value does not go down after free:

```cpp
yogi_memory_peak_bytes() >= base + 64;
```

## Debug Report

`yogi_memory_debug_report()` prints one compact line to `stderr`:

```text
yogi memory telemetry: live_bytes=0 live_allocations=0 total_allocated_bytes=96 total_freed_bytes=96 peak_bytes=64
yogi memory attribution: module=runtime-test function=cast-test source=tests/runtime/runtime_cast_test.io line=12 column=5 type=raw allocation live_bytes=0 live_allocations=0 total_allocated_bytes=32 total_freed_bytes=32 peak_bytes=32
yogi memory attribution: module=runtime-test function=cast-test source=tests/runtime/runtime_cast_test.io line=12 column=5 type=raw reallocation live_bytes=0 live_allocations=0 total_allocated_bytes=64 total_freed_bytes=64 peak_bytes=64
```

This is meant for tests, debugging, and future compiler tooling. It is not a
production profiler.

## Relationship To Ownership Debug

Ownership debug answers whether an operation is legal:

```text
double free
invalid free
use after aggregate destroy/drop
leaked ownership records
```

Memory telemetry answers how much memory passed through the runtime allocator:

```text
live bytes
live runtime allocations
total allocated bytes
total freed bytes
peak live bytes
```

They are intentionally separate. Telemetry should keep working even if ownership
debug is disabled later for release builds.

## Current Limits

- Telemetry is process-local and currently single-thread oriented.
- Internal telemetry bookkeeping uses system allocation directly to avoid
  recursive calls into `MemoryManager`.
- It groups by module, function, source path, line, column, and runtime
  allocation type.
- It does not automatically fail on leaks; ownership debug remains responsible
  for explicit leak reports.
- It records source locations only where the backend currently emits
  source-location scopes. More expression kinds can be added as they begin to
  allocate resources.

Those are future lots once module-aware runtime metadata is stronger.
