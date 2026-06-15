# Variables

Variables in Yogi use TypeScript-like syntax with stricter rules.

## Declarations

Valid declarations:

```ts
let count: number = 0
const name: string = "release"
let ready: boolean = false
let maybeName: string | undefined = undefined
```

Invalid declarations:

```ts
var count: number = 0
let count = 0
let count: number
```

Rules:

- `var` is rejected.
- A type annotation is required.
- An initializer is required.
- `const` cannot be reassigned.
- `let` can be reassigned when the new value matches the declared type.

## Primitive Values

Supported primitive variable types include:

- `number`
- `string`
- `boolean`
- `undefined`
- `null`
- `void` for function returns
- `any`

`any` is allowed at declaration time, but using it as a concrete type requires
an explicit cast.

```ts
let raw: any = 10
let value: number = raw as number
```

This is rejected:

```ts
let raw: any = 10
let value: number = raw
```

## Unions

Union types can be initialized with any compatible member.

```ts
let value: string | number = 10
value = "ready"
```

Nullish patterns are supported for values that include `undefined` or `null`.

```ts
let cached: string | undefined = undefined
let owner: string = cached ?? "platform"
cached ??= "release-team"
```

## Objects

Object literals are checked against their declared object type.

```ts
let user: { name: string, age: number } = { name: "Ana", age: 20 }
let userName: string = user.name
user.age = user.age + 1
```

The semantic analyzer rejects:

- Missing required properties.
- Extra properties not present in the declared type.
- Wrong property value types.
- Writes to `readonly` properties.

## Arrays and Tuples

Arrays:

```ts
let scores: number[] = [10, 20, 30]
scores[1] = 25
let middle: number = scores[1]
```

Tuples:

```ts
let pair: [number, string] = [1, "ready"]
pair[0] = 2
let label: string = pair[1]
```

The semantic analyzer validates array element types, tuple length, tuple index
types, and readonly aggregate writes.

## Current Backend Behavior

Primitive locals are lowered as LLVM local slots.

Aggregate variables use the stack-first model:

- Local non-escaping object and array descriptors are allocated with LLVM
  `alloca`.
- Their internal dynamic buffers are initialized through the Yogi runtime.
- Before returning from the function, the backend emits runtime cleanup calls.
- Globals, exports, and returned aggregate identifiers are marked as escaping
  and use heap-backed runtime creation.
