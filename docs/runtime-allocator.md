# Runtime Allocator

This document tracks the allocator lot for the Yogi runtime.

The goal is to keep the generated LLVM backend independent from concrete
allocator libraries. Generated code must call only the Yogi runtime allocator
ABI:

```c
extern "C" void *yogi_alloc(unsigned long long size);
extern "C" void *yogi_realloc(void *address, unsigned long long newSize);
extern "C" void yogi_free(void *address);
```

The LLVM backend must not call `malloc`, `free`, `realloc`, `mi_malloc`,
`mi_free`, `mallocx`, or `dallocx` directly. The runtime `MemoryManager`
decides which allocator implementation backs those ABI calls.

## Supported Allocators

Yogi supports three build-time allocator modes:

```text
YOGI_ALLOCATOR=mimalloc
YOGI_ALLOCATOR=jemalloc
YOGI_ALLOCATOR=system
```

`mimalloc` is the default.

## mimalloc

`mimalloc` lives in:

```text
tools/mimalloc
```

When configured with:

```sh
cmake -S . -B build -DYOGI_ALLOCATOR=mimalloc
```

CMake builds `tools/mimalloc` as a local dependency in the build directory,
defines `YOGI_USE_MIMALLOC`, and links `yogi_runtime` against
`mimalloc-static`.

If `tools/mimalloc` is missing or cannot create the expected target, configure
or build fails with a clear error. There is no silent fallback to the system
allocator.

## jemalloc

`jemalloc` lives in:

```text
tools/jemalloc
```

When configured with:

```sh
cmake -S . -B build -DYOGI_ALLOCATOR=jemalloc
```

CMake builds `tools/jemalloc` through its local Autotools flow in the build
directory, defines `YOGI_USE_JEMALLOC`, and links `yogi_runtime` against the
locally built `libjemalloc.a`.

If `tools/jemalloc`, `autoconf`, or `make` is missing, configure fails with a
clear error. There is no silent fallback.

## system

When configured with:

```sh
cmake -S . -B build -DYOGI_ALLOCATOR=system
```

the runtime defines `YOGI_USE_SYSTEM_ALLOCATOR` and uses:

```text
std::malloc
std::realloc
std::free
```

This is an explicit mode. Selecting `system` does not require `mimalloc` or
`jemalloc`.

## Generated Executables

The compiler executable links against `yogi_runtime` through CMake. Generated
Yogi programs are linked separately by the LLVM backend with LLD.

For that second link step, CMake passes:

```text
YOGI_RUNTIME_LIBRARY_PATH
YOGI_RUNTIME_ALLOCATOR_LIBRARY_PATH
```

The backend appends the runtime archive and then the allocator archive when the
selected allocator has a separate library. `system` leaves the allocator path
empty.

This keeps generated executables consistent with the allocator selected when
the compiler/runtime were built.

## Debug Confirmation

The runtime exposes:

```c
extern "C" const char *yogi_allocator_name(void);
```

It returns the allocator compiled into the runtime:

```text
"mimalloc"
"jemalloc"
"system"
```

Runtime tests use this function to verify that the configured allocator and the
actual linked runtime agree.
