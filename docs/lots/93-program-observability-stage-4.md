# Lot 93: Program Observability Stage 4

## Goal

Close the structural observability core needed by Program Tests. Stage 4
reconstructs owners, bounded borrows, function frames, and dynamic cleanup
obligations across the control-flow exits Yogi currently lowers:

```txt
normal
return
break
continue
```

This is the final large observability-only lot for now.

## Dynamic Cleanup Generations

Stage 3 described lexical cleanup plans. Stage 4 also observes each runtime
activation:

```txt
cleanup.activate
cleanup.rearm
cleanup.cancel
cleanup.execute
cleanup.skip
```

The reducer keys a dynamic obligation by:

```txt
runtime process + frameId + cleanupId + generation
```

Re-entering a loop may activate the same lexical `cleanupId` again. That starts
a new generation and is valid. Activating it again before the current
generation closes is an error.

Every active generation must end in exactly one of:

```txt
cancel   ownership left the local owner
execute  the local owner ran its destructor
rearm    reassignment destroyed/replaced the old generation and installed the next
skip     the runtime slot was null, so no destructor call was required
```

The analyzer rejects:

```txt
frame exit with an active obligation
execute/cancel without an active obligation
duplicate execute/cancel
runtime execution on an exit path not emitted by lowering
cleanup execution outside its active frame
```

## Frame Reducer

`function.frame.enter` now records `frameId` and `parentFrameId`.
`function.frame.exit` records:

```txt
normal
return
```

Frames must be balanced and LIFO. Semantic decisions and dynamic cleanup events
carry the active `frameId`, so the analyzer can prove that an operation ran in
the invocation that owned its obligation.

`break` and `continue` do not close a function frame. Their cleanup executions
carry `exitReason: break` or `exitReason: continue` before LLVM branches to the
corresponding target.

## Owner and Borrow Reducers

Owner reduction combines:

```txt
semantic Move decisions
cleanup activation
cleanup cancellation
cleanup execution
```

Move decisions retain their stable source `valueId` from the frontend decision
plan. Dynamic cleanup generations provide the exactly-once owner obligation
used for runtime validation.

Current observable borrows are expression- or call-scoped. A runtime `Borrow`
decision is therefore reduced as one complete non-owning interval inside the
active frame. It must identify its source value and never creates a cleanup
obligation.

This is deliberately not a Rust-style borrow checker and does not introduce a
second ownership system.

## Control-Flow Program

`ownership_control_flow_observability` is a complete Yogi Program Test with:

```txt
native resource-owning structs
automatic return transfer
ptr<T> borrows
normal scope exit
early return
while loop
break
continue
native-owned strings
exact native lifetime counters
LLVM verification
```

Its manifest requires cleanup executions for all four exit reasons. The
analyzer reconstructs frames, owner transitions, borrows, and dynamic cleanup
generations while the fixture independently proves that all resources were
destroyed exactly once.

## Negative Proof

Analyzer fixtures intentionally inject and reject:

```txt
lost cleanup obligation
duplicate cleanup execution
cleanup on a lowering path that does not exist
non-LIFO frame exit
borrow decision without a stable source identity
```

## Stable Boundary

After Stage 4, Program Observability is considered stable and sufficient for
the current language:

```txt
frontend decision -> SIR -> lowering -> LLVM metadata -> runtime frame/path
owner activation -> borrow/move -> cancel or cleanup execution
```

Future observability work must accompany a real language/runtime feature and
extend these reducers incrementally. There is no planned Stage 5 structural
observability project.

## Remaining Limitations

```txt
Borrow observations currently model bounded expression/call borrows, not
arbitrary overlapping mutable-borrow intervals.

Legacy Program Tests without surgical manifests still rely on explicit
transitional survivor allowances.

Some historical pipeline tests still inspect LLVM text instead of using the
structural Program IR inspector.

New runtime entities introduced by future language features will need their
own focused identities and reducer rules when those features land.
```
