# Lot 88: Resource Array Ownership Across Function Boundaries

## Goal

Complete the ownership contract for dynamic arrays whose struct elements own
native resources when those arrays cross function boundaries.

Escape analysis answers whether the storage can outlive the current scope.
This lot additionally preserves the destructor metadata that tells LLVM and the
runtime how each resource field must be cleaned.

## Public Semantics

### Owned return

```ts
function makeBatch(): JobTicket[] {
    let tickets: JobTicket[] = []
    tickets.push(createTicket(1))
    return tickets
}

let batch: JobTicket[] = makeBatch()
```

`return tickets` transfers the array owner and its element-destructor policy to
the caller. The callee does not destroy `tickets`; `batch` becomes responsible
for its final cleanup. Forwarding the result through another function preserves
the same policy.

### Borrowed parameter

```ts
function totalScore(tickets: ptr<JobTicket[]>): number {
    let total: number = 0

    for (let ticket: JobTicket of tickets) {
        total = total + ticket.score
    }

    return total
}

print(totalScore(&batch))
```

`ptr<JobTicket[]>` is a temporary borrow. The caller remains the owner and the
callee does not schedule array cleanup. Mutable pointer iteration may update
fields while preserving that ownership.

### Unsafe value copy

```ts
function inspect(tickets: JobTicket[]): number {
    return tickets.length
}

inspect(batch)
```

This is rejected when `JobTicket` owns native resources. A normal `T[]`
parameter has local/value semantics, and a shallow value copy would create two
owners for the same resource. The diagnostic recommends `ptr<JobTicket[]>` and
`&batch` instead.

Copyable element arrays keep their existing behavior. A known callee that
stores or returns an aggregate still propagates escape through its function
effect summary.

## Compiler Pipeline

1. Semantic analysis collects each returned array element field and its native
   destructor.
2. Function symbols and module exports carry that return metadata.
3. Calls encode owned/borrowed array return metadata into SIR without changing
   the public language syntax.
4. LLVM lowering registers cleanup only for owned results and aliases borrowed
   results to the original owner.
5. A discarded owned array result is destroyed at the end of the expression,
   including every resource-owning element.
6. Returning an object or array containing a local resource deactivates cleanup
   in the callee before control-flow cleanup runs.

## Program Test

`tests/programs/native_resource_array_function_boundaries.cmake` builds a native
C resource fixture and a complete Yogi program. It covers:

- direct and forwarded owned array returns
- read and mutable `ptr<T[]>` borrows
- discarded owned return cleanup
- conditional empty/owned returns
- early-return cleanup
- loop stress with `continue` and `break`
- LLVM IR, object, executable, and runtime output
- exact created, destroyed, live, duplicate-destroy, and invalid-destroy counts

The expected final state is 20 resources created, 20 destroyed, zero live,
zero duplicate destruction, and zero invalid destruction.

## Sanitizer Validation

`YOGI_ENABLE_SANITIZERS=ON` instruments the compiler/runtime and native fixture
with ASan/UBSan and enables leak detection where the platform supports it. This
lot's sanitizer run found and fixed a real telemetry use-after-free: allocation
records stored raw pointers into a growable attribution table. Records now store
stable indices, and `runtime_memory_telemetry_test` forces the table past its
initial capacity before freeing early allocations.

## Defects Found by the Expanded Tests

The broader regression suite exposed two additional compiler defects:

- A `return` inside stable `for...of` emitted cleanup for the return path but
  removed the compiler cleanup registration needed by the loop's normal exit.
  Return-path cleanup emission now preserves registrations for sibling control-
  flow paths. `break` and `continue` still consume their iteration-scope
  cleanups normally, preventing repeated destruction.
- The custom struct parser did not consume `?` in optional fields and treated
  `readonly` as a field name. An optional struct property could therefore trap
  the parser in a non-progressing loop. Struct fields now carry modifiers and a
  question token through the parser AST/factory/visitor, and malformed members
  always advance after reporting a diagnostic.

These fixes are covered by the existing struct-declaration and dynamic-array
iteration pipeline tests in addition to the new Program Test.

## Remaining Boundary

Structural mutation of a resource-owning array through a generic `ptr<T[]>`
callee still needs an explicit transport mechanism for element-destructor
metadata inside that callee. Read borrows and non-structural element-field
mutation are supported. The next array lot should close structural methods such
as `push`, `pop`, `shift`, and `splice` through borrowed generic parameters.
