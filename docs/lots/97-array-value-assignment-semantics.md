# Lot 97: Array Value Assignment Semantics

## Question

What deep error can exist even when target replacement, slot pointers, and
cleanup tests all pass?

The target can look correct while `=` silently consumes the source:

```ts
let source: number[] = [1, 2, 3]
let target: number[] = source
```

If both bindings alias one descriptor, or replacement moves elements out of
`source`, Yogi has violated value semantics even if no double-free occurs.

## Language Rule

Normal dynamic-array assignment is non-destructive:

```txt
T[] = T[]          -> independent owned copy
T[] = borrowed T[] -> independent owned materialization
return borrowed T[] as T[] -> independent owned materialization
```

The explicit sharing mechanism remains `ptr<T[]>`:

```ts
let source: number[] = [1, 2, 3]
let pointer: ptr<number[]> = &source
let view: number[] = pointer

view[0] = 99
print(source[0]) // 99
```

The local view is a borrow and never registers a second descriptor cleanup.

## Compiler Strategy

The semantic pass classifies the right-hand side before lowering:

```txt
named array / borrowed view / projection:
    materialize array.copy()

fresh array literal / fresh owned return:
    transfer the unobservable temporary internally

direct ptr<T[]> local initialization:
    preserve the borrow
```

This keeps the source-level rule simple while retaining efficient transfer for
temporaries that the program cannot observe.

## Runtime ABI

The runtime operations are now deliberately separate:

```txt
yogi_array_replace_from
    non-consuming copy replacement
    source remains unchanged

yogi_array_move_replace_from
    consuming replacement
    reserved for compiler-created temporaries and explicit consuming operations
```

Both preserve surviving target slot identities. A shorter replacement still
invalidates removed target slots according to the existing pointer-validity
model.

## Non-Copyable Elements

When array elements own native resources, normal assignment must not produce a
shallow second owner. Known ownership metadata produces a semantic diagnostic.
The runtime descriptor also calls `yogi_array_assert_copyable` defensively, so
missing frontend metadata fails with a defined ownership error rather than a
silent move.

## Coverage

Frontend coverage verifies:

```txt
owned source -> owned destination
ptr<T[]> -> local borrowed view
borrowed view -> owned destination
borrowed return -> owned caller value
resource-owning array assignment rejection
```

Runtime unit coverage verifies that `yogi_array_replace_from` preserves its
source and that `yogi_array_move_replace_from` consumes only its explicit
temporary source.

The strict Program Test is:

```txt
tests/programs/array_value_assignment_report.cmake
tests/programs/manifests/array_value_assignment_report.json
```

It checks source length/content, destination independence, mutable borrows,
return materialization, value parameters, repeated assignments, slot pointer
stability, early control-flow paths, LLVM IR, final executable output, cleanup,
sanitizers, and `allowLive: []`. The same Program Test also compiles an
aggregate-element assignment as a negative scenario and requires the defined
recursive-copy diagnostic.

## Remaining Limitations

Nested dynamic arrays and boxed object/struct payloads still need complete
recursive copy/destruction metadata. Normal assignment rejects those element
types instead of creating a shallow alias that pretends to be an independent
owner. Arrays whose descriptor reports resource-owning elements remain
non-copyable until an explicit element copy policy exists.
