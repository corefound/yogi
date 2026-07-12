# Lot 45: Dynamic Array Pointer Semantic Invalidation

This lot adds compile-time diagnostics for dynamic array pointers when semantic
analysis can prove that a later pointer use targets a removed slot.

## Goal

Runtime slot validity remains the final safety layer, but obvious cases should
not reach LLVM:

```ts
struct User {
    age: number
}

let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[1].age

users.pop()
age = 99
```

Yogi now reports this during semantic analysis:

```txt
pointer 'age' is used after its target dynamic array element 'users[1].age' was removed by 'pop'
```

## Model

Semantic analysis already tracks live pointer provenance:

```txt
pointer symbol -> root dynamic array + access path
```

This lot extends that provenance with an invalidated state:

```txt
valid pointer provenance:
  pointerName = age
  rootName = users
  accessPath = [1], .age

after users.pop():
  invalidated.operation = pop
  invalidated.reason = slot 1 in users was removed
```

The removal does not immediately fail. This is valid:

```ts
let users: User[] = [{ age: 20 }, { age: 30 }]
let age: ptr<number> = &users[1].age

users.pop()
print(users.length)
```

The pointer is dead, but it is not used again.

## Compile-Time Cases

The compiler marks a pointer invalidated when it can prove the removed index:

```txt
shift()                  invalidates literal pointer index 0
pop()                    invalidates literal pointer index length - 1 when length is known
splice(start, count)     invalidates literal pointer indexes in a known removed range
array = literal          invalidates literal pointer indexes >= new literal length
```

Known dynamic array length is intentionally lightweight. It starts from array
literals and is updated through obvious operations such as `push`, `pop`,
`shift`, `unshift`, `splice`, and literal replacement. If the compiler loses
certainty, the case remains runtime-checked.

## Runtime-Only Cases

Dynamic cases still use runtime slot checks:

```ts
let users: User[] = [{ age: 20 }, { age: 30 }, { age: 40 }]
let index: number = 1
let start: number = 0
let count: number = 2

let age: ptr<number> = &users[index].age
users.splice(start, count)
age = 99
```

The access path and removed range are not literal, so semantic analysis does not
pretend to know the answer. The runtime reports the invalid pointer use.

## Pointer Copies

Invalidation propagates through pointer copies:

```ts
let age1: ptr<number> = &users[0].age
let age2: ptr<number> = age1

users.shift()
age2 = 99
```

`age2` keeps the same provenance and fails with the same compile-time
diagnostic.

## Covered Uses

Semantic invalidation is checked when a pointer is actually used:

```txt
scalar read-through: print(age), let value: number = age
scalar write-through: age = 99
pointer property projection: user.age = 99
pointer element projection: pointer[0]
passing an invalid pointer to a pointer parameter
```

Pointer rebinding is still allowed:

```ts
age = &users[0].age
```

Rebinding replaces the old provenance with the new target.

## Tests

Covered by:

```txt
tests/runtime/sessions/02-variables-aggregates/dynamic_array_pointer_validity_tracking.cmake
```

Semantic negative coverage:

```txt
pop removes pointed slot and pointer is used afterward
shift removes pointed slot and pointer is used afterward
splice removes pointed literal slot and pointer is used afterward
copied pointer to removed slot is used afterward
copying an already invalidated pointer preserves the error
passing an invalidated pointer to a pointer parameter fails
ptr<User> field access after owner slot removal
nested projected pointer after owner slot removal
shorter literal replacement removes pointed slot
shorter literal replacement removes nested projected pointer owner slot
parameter local pointer invalidated by literal replacement
```

Runtime negative coverage:

```txt
dynamic splice/index removes pointed slot and pointer is used afterward
```

## Completed

- ✅ semantic provenance can carry invalidated state
- ✅ obvious removed-slot pointer uses fail before LLVM generation
- ✅ pointer copies preserve invalidated provenance
- ✅ pointer rebind replaces invalidated provenance with the new target
- ✅ dynamic/unknown cases remain runtime checked
- ✅ no global pointer scanning
- ✅ no GC

## Pending / Future

- ⬜ richer branch-sensitive invalidation merging
- ⬜ diagnostics with a secondary note at pointer creation and removal site
- ⬜ compile-time removal proofs for more non-literal but constant-foldable cases
- ⬜ function-summary propagation for pointer invalidation effects
