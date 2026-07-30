# Lot 92: Program Observability Stage 3

## Goal

Prove that automatic destruction is not only eventually successful, but also
correctly scheduled, cancelled after ownership transfer, emitted into LLVM, and
executed on the runtime path that needs it.

The lot also replaces fragile LLVM text matching with structural inspection.

## Cleanup Identity

Every lowering cleanup registration receives a deterministic module-local ID:

```txt
cleanup:module:main.ts:000001
```

The obligation records:

```txt
owner
symbol ID
cleanup kind
destroy function
stack/heap storage
source position
```

The ID belongs to the lexical cleanup responsibility, not to an allocation
address. Copying ownership state while lowering branches preserves the same ID.

## Lifecycle Events

```txt
cleanup.schedule
cleanup.rearm
cleanup.cancel
cleanup.emit
cleanup.execute
```

Examples:

```ts
let label: string = jobs.makeLabel(2)
print(label)
```

Produces:

```txt
schedule label/yogi_string_destroy
emit cleanup site
execute cleanup at runtime
```

For an automatic move:

```ts
let ticket: JobTicket = createTicket()
consume(ticket)
```

The caller's obligation is cancelled because the value parameter becomes the
next owner:

```txt
schedule ticket/struct.cleanup
cancel ticket/struct.cleanup
```

## LLVM Correlation

Generated cleanup observer calls carry:

```llvm
!yogi.cleanup
!yogi.owner
!yogi.destroy
```

The module also contains:

```llvm
!yogi.cleanup.obligations
```

Runtime observer calls are inserted only in observability builds.

## Structural Inspector

The Program Trace Analyzer now:

```txt
discovers every .ll below the Program Test artifact root
parses modules with LLVM IRReader
runs LLVM verifyModule
checks manifest expectations through LLVM objects
```

Supported expectations:

```txt
function
call
call-site metadata
named metadata
exact or minimum counts
```

This avoids treating whitespace, SSA names, or instruction formatting as test
contracts.

## Surgical Program

`native_job_ticket_ownership` no longer reads LLVM text with regexes. Its
manifest structurally verifies:

```txt
native function calls
native-owned string conversion
semantic observer metadata
cleanup observer metadata
semantic decision table
cleanup obligation table
```

Its trace verifies eight cleanup obligations:

```txt
five cancelled after moves
three emitted and executed
zero anomalies
zero allowed live entities
```

## Negative Tests

The analyzer self-test now rejects:

```txt
cleanup scheduled without emission or cancellation
required LLVM call missing from a valid module
semantic decision missing from lowering
allocation identity resurrection
```

## Follow-up

Lot 93 completed the owner, borrow, frame, and dynamic cleanup reducers,
including correlation for normal exit, early return, `break`, and `continue`.
