# Lot 91: Program Observability Stage 2

## Goal

Explain why a value was copied, moved, borrowed, escaped, materialized, or
promoted, and prove that the same compiler decision survives every phase.

Stage 1 proved that runtime resources ended cleanly. Stage 2 adds the semantic
causality behind that result.

## Stable Identity

The frontend assigns deterministic IDs after parsing and semantic analysis:

```txt
module:main.ts
node:main.ts:000042
value:main.ts:000019
type:sha256:<normalized-resolved-type-hash>
decision:main.ts:000007
```

Symbol and scope IDs are module-qualified. Equivalent source compiled in
different processes produces the same semantic identities; PID, event sequence,
and runtime addresses are not part of the identity.

## Typed Decisions

The SIR module now contains `ValueIdentity` and `SemanticDecision` side tables.
Each decision carries:

```txt
decisionId
nodeId
valueId
typeId
kind
reason
context
relatedIds
runtimeRequired
source position
```

Examples:

```ts
let copied: Point = point
```

```txt
Copy / TrivialValueCopy
```

```ts
return ticket
```

```txt
Move / ReturnTransfersToCaller
```

```ts
inspect(&ticket)
```

```txt
Borrow / AddressOfBorrow
```

When escape analysis requires extended storage:

```txt
Escape / DeclaredValueEscapes
Promote / EscapeRequiresHeap
Storage / HeapStorage
```

Primitive values do not receive aggregate borrow decisions merely because they
are function arguments.

## Cross-Phase Correlation

One decision follows this chain:

```txt
frontend: semantic.decision.plan
SIR:      sir.decision.read
lowering: lowering.decision.consume
runtime:  semantic.decision.execute
```

Lowered observer calls carry:

```llvm
!yogi.node
!yogi.value
!yogi.type
!yogi.decision
```

The backend emits at most one observer call for the same decision inside one
generated LLVM function. A function invoked multiple times can naturally
produce multiple runtime execution events.

## Analyzer Rules

The Program Trace Analyzer rejects:

```txt
decision planned but absent from SIR
decision read from SIR but not consumed by lowering
duplicate compile-stage decision
kind/reason mismatch between phases
missing required runtime execution
```

Runtime execution is not mandatory by default because dead branches and
uninvoked functions are valid. Surgical Program Test manifests declare
`runtimeAtLeast` when the scenario must execute that decision.

## Program Test

`native_job_ticket_ownership` now verifies:

```txt
trivial Point copy
resource-owning return transfer
resource-owning assignment transfer
resource-owning by-value parameter consumption
address-of borrow
escape-driven heap promotion
native resource creation/destruction
LLVM metadata and executable behavior
```

Its manifest requires every selected decision to be planned, lowered, and
executed. Existing exact native lifetime counters remain an independent oracle.

## Production Isolation

The FlatBuffer identity tables remain compile artifacts. Runtime event calls,
trace state, and `!yogi.*` instrumentation are gated by:

```cmake
-DYOGI_ENABLE_PROGRAM_OBSERVABILITY=ON
```

With the option disabled, normal Yogi executables do not link the observability
writer or emit semantic observer calls.

## Remaining Work

Stage 3 should add:

```txt
cleanup schedule/emit correlation
LLVM API-based structural assertions
replacement of fragile IR regex checks
owner and borrow graph reducers
control-flow-aware cleanup obligation validation
```
