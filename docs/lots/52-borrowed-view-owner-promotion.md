# Lot 52: Borrowed View Owner Promotion

This lot adds the first owner-promotion path for fixed-shape borrowed array
views that escape into storage where aliasing remains observable.

## Problem

Automatic materialization is safe when copying a view does not change observable
behavior. It is not safe when another alias can still observe mutations after
the escape.

```ts
let saved: number[3] = [0, 0, 0]

function save(): void {
    let matrix: number[2, 3] = [[1, 2, 3], [4, 5, 6]]
    let row: number[3] = matrix[1]

    saved = row
    row[0] = 40
    matrix[1, 1] = 50
}

save()
print(saved[0]) // 40
print(saved[1]) // 50
```

If `saved = row` copied the row immediately, the later writes would not be
visible through `saved`.

## Implemented Behavior

When a fixed-shape borrowed view escapes through module/global storage or an
aggregate member store:

```txt
1. Semantic analysis marks the source owner as escaping.
2. The SIR declaration is rewritten with `escapes=true`.
3. LLVM lowering aliases borrowed view variables back to their real owner.
4. The backend retains the view source before the view escapes.
5. The local owner cleanup is deactivated so the view cannot dangle.
6. Runtime view cleanup releases the retained source when the escaped view dies.
```

This is not GC. It is explicit ownership extension for escaped borrowed views.

## Remaining Work

Normal known function calls keep Yogi's current value semantics for array
parameters, so retaining callees still receive materialized/copy-safe values.
Nested object-literal returns also use safe materialization when that preserves
behavior. Closure-captured views, pointer-parameter borrow surfaces, and more
complex owner promotion through nested object graphs need a later focused pass.
