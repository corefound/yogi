# Lot 66: Array Destructuring and Rest Bindings

## Goal

Add array destructuring declarations without introducing a new SIR node or a
new runtime representation.

The compiler lowers destructuring patterns into ordinary variable declarations
before semantic analysis serializes the module.

## Implemented

``` ts
let values: number[] = [10, 20, 30, 40]
let [first, , third, ...tail]: number[] = values

print(first)  // 10
print(third)  // 30
print(tail[0]) // 40
```

Supported forms:

``` txt
identifier bindings
array holes
rest bindings at the end of the pattern
tuple-rest annotations, for example [number, ...number[]]
for-of destructuring through values.entries()
nested non-rest binding patterns through the existing expansion path
```

## Lowering

Plain array destructuring lowers to element access:

``` ts
let [first, second]: number[] = values
```

Conceptually becomes:

``` ts
let first: number = values[0]
let second: number = values[1]
```

Rest bindings lower to `slice(index)`:

``` ts
let [head, ...tail]: number[] = values
```

Conceptually becomes:

``` ts
let head: number = values[0]
let tail: number[] = values.slice(1)
```

That keeps the pipeline on existing semantic and LLVM paths:

``` txt
ElementAccessExpression
CallExpression with builtinMethod=array.slice
VariableDeclaration
```

## Strict Rules

Yogi still requires explicit type annotations:

``` ts
let [head, ...tail] = values
// error: Missing explicit type annotation
```

Rest bindings must be last:

``` ts
let [...head, last]: number[] = values
// error
```

Rest bindings currently require an identifier:

``` ts
let [...[first]]: number[][] = values
// not supported yet
```

## Tests

Focused pipeline test:

``` txt
tests/runtime/sessions/02-variables-aggregates/array_destructuring.cmake
```

Program test:

``` txt
tests/programs/sales_destructuring_report.cmake
```

The tests verify LLVM artifacts, runtime execution, array `slice`, array
`entries`, element access, positive destructuring, and semantic failures for
invalid patterns.

## Remaining

``` txt
deeper rest binding patterns
more precise fixed-length validation for destructuring from fixed arrays
dynamic-to-fixed destructuring restrictions if Yogi adds fixed targets there
ownership diagnostics for rest arrays that contain resources
```
