# Lot 33: Pointer Dereference Syntax (Superseded)

Lot 33 originally introduced public `*p` / `(*p) = value` pointer dereference
syntax. That public syntax was removed in Lot 34.

Current Yogi code should use:

```ts
let value: number = 7
let p: ptr<number> = &value

print(p)     // scalar read-through
p = 42       // scalar write-through
print(value)
```

The compiler still uses `DereferenceExpression` internally in SIR/FlatBuffers
for scalar read-through lowering, but source code must not spell it as `*p`.

Public syntax now rejected:

```ts
print(*p)
(*p) = 42
```

Expected diagnostic:

```txt
Yogi does not use '*p' pointer dereference syntax; use 'p' directly
```

or:

```txt
Yogi does not use '(*p) = value'; assign to 'p' directly
```

See:

```txt
docs/lots/34-pointer-read-write-through.md
docs/pointers.md
```
