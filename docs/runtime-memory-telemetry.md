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
- It does not yet group allocations by module, function, source location, or
  aggregate kind.
- It does not automatically fail on leaks; ownership debug remains responsible
  for explicit leak reports.

Those are future lots once module-aware runtime metadata is stronger.
