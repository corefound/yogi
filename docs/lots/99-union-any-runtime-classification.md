# Lot 99: Union and `any` Runtime Classification

## Goal

Close the gap between union types accepted by semantic analysis and the values
actually emitted by LLVM. Before this lot, `number | string` could compile but
its scalar storage was initialized as a null pointer. Arrays of unions worked
because their elements were boxed through a separate array path.

## Implemented

```txt
TypeScript typeof syntax in the AST visitor
semantic typeof operation and direct-identifier if/else narrowing
runtime tags for primitives, arrays, objects, nullish values, and pointers
LLVM boxing for scalar union initialization and replacement
LLVM unboxing after a proven narrowing
owned cleanup for local/global any and union boxes
copy-before-replace for borrowed union values
owned union returns
independent by-value union/any parameters
runtime defensive cast validation
```

## Control-Flow Example

```ts
type Value = number | string

function measure(value: Value): number {
    if (typeof value == "number") {
        return value + 1
    }

    return value.length
}
```

The frontend records `value` as `number` only in the first branch and as
`string` in the complementary branch. The SIR identifier therefore carries
the narrowed type while its storage remains a tagged union box. LLVM consults
the original storage kind and emits `yogi_any_to_number` or
`yogi_any_to_string`.

## Aggregate Copy Example

```ts
type Payload = number[] | string

let source: Payload[] = [[1, 2]]
let copy: Payload = source[0]

if (typeof copy == "object") {
    copy[0] = 99
}
```

`source[0]` remains unchanged. `yogi_any_clone_owned` recursively clones the
array payload, while cleanup destroys each box and payload exactly once.

## Function Boundaries

A concrete argument entering a union parameter is boxed by an internal
compiler operation. The callee clones the box into its own parameter slot.
Reassigning the parameter therefore destroys only the callee-owned value.
Returning a union transfers the callee-owned box to the caller and cancels
only that cleanup obligation.

## Verification

```txt
Compiler Jest tests cover accepted and rejected narrowing.
The focused pipeline test checks diagnostics, LLVM IR, object generation,
linking, runtime values, aggregate copies, and cleanup symbols.
The union_any_narrowing_report Program Test covers value parameters, concrete
argument boxing, returns, global replacement, aggregate branches, loops,
continue, break, early return, strict observability, and allowLive: [].
```

## Remaining Boundaries

```txt
property-path and discriminated-union narrowing
Array.isArray and user-defined type guards
switch-based narrowing
post-terminating-branch narrowing after `if (...) return`
runtime bigint classification and narrowing
multiple object-like branches under typeof value == "object"
native ABI marshalling for union/any payloads
cyclic owned graph copying
clone contracts for exclusive native resources
recoverable allocation failure
boxed pointers do not extend pointee lifetime; provenance remains borrowed
```
