# Lot 89: Runtime Array Element Ownership Policy

## Goal

Make every dynamic array descriptor capable of moving and destroying its
elements without consulting caller-local compiler tables.

Before this lot, the descriptor knew storage facts such as length,
capacity, slot identity, and pointer invalidation. Resource cleanup still
depended on static metadata held by whichever function created or received
the array. That was insufficient for structural mutation through
`ptr<T[]>`.

## Runtime Contract

The descriptor now carries a type-erased element policy:

``` txt
resource-owning flag
destroy callback
move callback
opaque callback context
stable policy identity
```

The runtime owns policy dispatch. LLVM calls the stable array runtime ABI;
it does not reproduce element-destruction loops at each call site.

For a resource-owning struct element, LLVM emits one internal destroy thunk
that:

1. receives the boxed array element;
2. follows the recorded struct field path;
3. calls the configured native destructor for each owned resource field.

The policy identity prevents two incompatible element contracts from being
combined accidentally.

## Structural Operations

``` txt
push/unshift:
  move inserted elements into descriptor-owned slots

pop/shift:
  move one element out when the result is consumed

discarded pop/shift:
  destroy the removed element through the descriptor policy

splice:
  move removed elements into a new descriptor that inherits the policy;
  inserted elements move into the source descriptor

replacement:
  consume source elements, destroy replaced target elements, and preserve
  the target descriptor's slot-identity rules

cleanup:
  destroy each active resource-owning element exactly once
```

Array views delegate policy access to the source descriptor. A descriptor
returned from a function or passed as `ptr<T[]>` carries the same callback
and context naturally because the descriptor itself crosses the boundary.

## Nested Aggregates

Array descriptors can live in stack locals, heap aggregates, and struct
fields. Aggregate cleanup now uses `yogi_array_release`, which chooses the
correct stack-drop or heap-destroy path from runtime descriptor state.

Moving an array or tuple into a struct field deactivates the source cleanup
owner. The enclosing struct becomes responsible for releasing that field.

## Module Boundaries

Imported function symbols preserve their complete semantic signatures.
Imported struct declarations are emitted into the consumer SIR as
non-exported type dependencies. This gives each LLVM module the required
field layout while avoiding duplicate public type exports.

Public function calls create valid external LLVM declarations, and the
defining module reuses a prior declaration when lowering a forward call.

## Defensive Failures

The runtime rejects:

- resource-owning policies without a destroy callback;
- incompatible policy identities;
- attempts to shallow-clone a resource-owning array;
- resource elements that are not represented as boxed objects.

These are backend/runtime contract checks. Normal user mistakes should
still be rejected by semantic analysis first.

## Tests

Focused runtime coverage:

``` txt
tests/runtime/unit/runtime_array_storage_test.cpp
```

The unit test installs a policy directly, mutates storage, extracts and
discards values, transfers a splice range, and verifies exact destruction.

Complete program coverage:

``` txt
tests/programs/native_resource_array_pointer_policy.cmake
```

The program uses three Yogi modules and one native static library. It
checks:

- `ptr<T[]>` structural operations;
- push/pop/shift/unshift/splice;
- chained owned returns;
- nested aggregate storage;
- array replacement;
- reallocation stress;
- `if`, loops, `break`, `continue`, nested scopes, and discarded results;
- exact created/destroyed/live counters;
- duplicate destroy, invalid destroy, and use-after-free counters;
- LLVM verification, `.ll`, `.o`, final executable, and runtime output;
- ASan/UBSan and LSan when the platform supports them.

## Completion

``` txt
✅ Descriptor owns element destruction metadata
✅ ptr<T[]> remains a borrow
✅ Structural operations no longer depend on caller ownership tables
✅ Policy propagates through movement, return, nesting, and modules
✅ Runtime and Program Tests cover exact ownership behavior
```

User-facing generic function syntax was not added. The policy mechanism is
already generic internally because callbacks and context are type-erased.
