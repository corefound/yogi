# Program Observability TODO

Architecture:

```txt
docs/testing/program-observability-architecture.md
```

## Current

```txt
✅ Program Tests compile, lower, link, and execute complete Yogi programs
✅ Tests verify AST/SIR/LLVM/object/executable artifacts where relevant
✅ LLVM modules run LLVM verification
✅ Runtime ownership debug detects double-free, invalid free, and double destroy
✅ Memory telemetry attributes allocations to module/function/source
✅ Native resource tests expose exact lifetime counters
✅ ASan/UBSan and LSan where supported are integrated with CTest
✅ Program Observability architecture and staged migration plan documented
```

## Stage 1: Shared Runner and Runtime Lifetime Core

```txt
✅ Add YOGI_ENABLE_PROGRAM_OBSERVABILITY (OFF by default)
✅ Add a versioned Program Test manifest
✅ Add trace session coordinator and build-local trace directory
✅ Add structured runtime event writer
✅ Introduce monotonic allocation IDs independent of addresses
🟡 Frame, aggregate, and resource identities implemented; descriptor identity remains
✅ Unify memory telemetry and ownership debug observations in one event model
✅ Add automatic final memory/aggregate/resource/frame invariants
✅ Convert sanitizer/ownership diagnostics into structured anomaly records
✅ Add first-divergence report
✅ Migrate every registered Program Test through the shared runner
✅ Add a surgical native-resource-array-pointer-policy manifest
✅ Verify exact 33/33 native resource create/destroy history
✅ Reject allocation identity reuse after a lifetime ends
✅ Prove production executable contains no observability symbols when disabled
```

## Cleanup Debt Exposed by Stage 1

These are explicit, typed survivor allowances. They must be removed as their
cleanup implementations land:

```txt
⬜ any value
⬜ runtime string
⬜ object value
⬜ object properties
⬜ object property key
⬜ array value temporary descriptor
⬜ array view
⬜ array elements
⬜ array contiguous elements
⬜ projected pointer cell
```

No unbounded or wildcard survivor allowance is permitted.

## Stage 2: Frontend and SIR Identity

```txt
✅ Deterministic AST node IDs
✅ Module-qualified symbol and scope IDs
✅ Normalized structural type IDs
✅ Semantic value and decision IDs
✅ Typed copy/move/borrow/escape/storage/materialize/promote decisions
✅ AST/SIR correlation side tables
✅ Frontend trace producer
✅ Cross-run deterministic identity regression test
✅ Primitive values excluded from aggregate borrow decisions
```

## Stage 3: Backend and LLVM

```txt
✅ SIR decision-read and lowering-consumption events
✅ Runtime execution events for lowered semantic decisions
✅ !yogi.node/value/type/decision LLVM metadata
✅ Stable cleanup obligation IDs
✅ cleanup schedule/rearm/cancel/emit/runtime execution correlation
✅ !yogi.cleanup/owner/destroy and !yogi.cleanup.obligations metadata
✅ LLVM API-based module parsing and verification for every Program Test
✅ Structural function/call/call-metadata/named-metadata expectations
✅ Native Job Ticket migrated away from LLVM regex checks
🟡 Replace remaining historical IR regex checks as tests migrate
```

## Stage 4: Core Semantic Reducers

```txt
✅ Owner reducer from semantic moves and dynamic cleanup responsibility
✅ Bounded borrow reducer for expression/call-scoped borrows
✅ LIFO function/frame reducer with parent correlation
✅ Dynamic cleanup generations per cleanupId and frame invocation
✅ Normal/return/break/continue cleanup-path correlation
✅ Lost, duplicate, wrong-frame, and wrong-path obligation detection
✅ End-to-end control-flow Program Test with native lifetime counters
✅ Negative analyzer fixtures for each core failure class
```

## Stable Boundary

```txt
✅ Stage 4 is the final large observability-only lot
✅ Current infrastructure is stable and sufficient for Program Tests
✅ Future instrumentation must accompany real language/runtime features
✅ Main roadmap returns to Yogi language work
```

## Remaining Limitations

```txt
🟡 Borrow reduction currently covers bounded expression/call borrows
🟡 Legacy survivor allowances remain until their owning features gain cleanup
🟡 Historical LLVM regex assertions migrate when their tests are next changed
🟡 Future language entities need focused identities only when implemented
```
