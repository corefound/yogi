# Yogi

**Yogi** is a statically typed, ahead-of-time compiled programming language with a TypeScript-like syntax and a systems-level execution model.

Yogi is designed for developers who like the clarity and familiarity of TypeScript syntax, but want native performance, explicit memory behavior, C ABI interoperability, strict typing, and predictable compiled output.

The language is built around a simple idea:

> Write code that feels familiar, but compiles like a serious native language.

Yogi is not a JavaScript runtime, not a TypeScript transpiler, and not a garbage-collected scripting language. It uses its own compiler pipeline, static type system, ownership model, native backend, and runtime rules.

---

## Goals

Yogi focuses on:

- **Ahead-of-time compilation** to native binaries.
- **TypeScript-like syntax** without JavaScript runtime semantics.
- **Strict static typing** with explicit types everywhere.
- **No type inference** at declarations.
- **RAII-style lifetime management** instead of garbage collection.
- **Pointer support** with safe syntax and strict provenance rules.
- **Native C ABI interop** through `extern` declarations.
- **Predictable objects, arrays, structs, and memory layouts**.
- **LLVM-based backend** for optimized native code generation.

---

## Basic Syntax

Yogi keeps the surface syntax close to TypeScript while making the type system stricter.

```ts
function add(a: number, b: number): number {
    return a + b
}

let result: number = add(10, 20)
print(result)
```

All variable declarations must include an explicit type:

```ts
let name: string = "Yogi"
let version: number = 1.0
let enabled: boolean = true
```

Yogi does **not** infer declaration types:

```ts
// Invalid in Yogi
let value = 10

// Valid in Yogi
let value: number = 10
```

---

## Pointers

Yogi supports pointers through the `ptr<T>` type.

Pointers are explicit. Address-of uses `&value`, and dereference uses `*pointer`.

```ts
let value: number = 7
let p: ptr<number> = &value

print(p)

p = 42
print(value)
```

Output:

```txt
7
42
```

A pointer can only point to a compatible value:

```ts
let count: number = 10
let countPtr: ptr<number> = &count
```

---
## Pointer Mutability

### Pointer write access comes from the original value.

#### A pointer to a `let` value can write through the pointer:

```ts
let value: number = 1
let p: ptr<number> = &value

p = 2
print(value)
```

#### A pointer to a `const` value is read-only:

```ts
const value: number = 1
let p: ptr<number> = &value

// Invalid: cannot write through pointer to const origin
p = 2
print(p)
```

A `const` pointer means the pointer variable cannot be reassigned, but it does not automatically make the pointed value read-only:

```ts
let value: number = 10
const p: ptr<number> = &value

p = 20      // Valid: value is mutable
print(p)

```

```ts
let value: number = 10
const p: ptr<number> = &value

p = 20 // Valid: value is mutable

let other: number = 20
p = &other // Invalid: p itself is const

print(p)
```

Yogi does not use `ptr<const T>`. Mutability is tracked from the pointer origin instead of encoded as a separate pointer type.

---

## Pointers to Arrays and Matrix Values

Pointers can reference array elements and multidimensional matrix elements.

```ts
let numbers: number[] = [10, 20, 30]
let second: ptr<number> = &numbers[1]

second = 99
print(numbers[1])
```

Fixed-size multidimensional arrays use explicit dimensions:

```ts
let matrix: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

let cell: ptr<number> = &matrix[1, 2]
print(cell)
```

Output:

```txt
6
```

A pointer can also point to the full matrix:

```ts
function read(matrix: ptr<number[2, 3]>): number {
    return matrix[1, 2]
}

let data: number[2, 3] = [
    [1, 2, 3],
    [4, 5, 6]
]

print(data)
```

---

## Objects Are Fixed Layout Records

Yogi objects are not dynamic JavaScript maps by default. Object shapes are known at compile time, and every field has a declared type.

```ts
type User = {
    id: number
    name: string
    active: boolean
}

let user: User = {
    id: 1,
    name: "Ada",
    active: true
}

print(user.name)
```

Because object fields have stable, known layouts, Yogi can safely take pointers to fields:

```ts
let namePtr: ptr<string> = &user.name

namePtr = "Grace"
print(user.name)
```

Dynamic index signatures are not part of regular object shapes:

```ts
// Invalid in Yogi
// type Bag = {
//     [key: string]: number
// }
```

---

## Native Interop with `extern`

Yogi can call native libraries through explicit `extern` declarations.

The `extern` block describes native functions available from an object file, static library, dynamic library, or C-compatible native module.

```ts
extern ffmpeg from "./native/ffmpeg.o" {
    toMP3(input: string, output: string): void
}

function main(): void {
    ffmpeg.toMP3("input.wav", "output.mp3")
}
```

Another example using a native math library:

```ts
extern mathlib from "./native/mathlib.o" {
    fastSqrt(value: number): number
    distance(x1: number, y1: number, x2: number, y2: number): number
}

let d: number = mathlib.distance(0, 0, 10, 20)
print(d)
```

The goal is to make native interoperability explicit, predictable, and safe from the Yogi side.

---

## Structs and Custom Runtime Layouts

Yogi supports `struct` declarations for custom types with explicit runtime layout and validation behavior.

A struct can define:

- `layout` for its native representation.
- `validate()` for runtime validation rules.

```ts
struct int8 extends number {
    layout ctx: Layout<number> {
        size: 8,
        signed: true,
        align: 1
    }

    validate(): boolean {
        return this % 1 == 0 && this >= -128 && this <= 127
    }
}

let port: int8 = 80
```

Structs are meant for real native layout control, not only type branding.

---

## Arrays

Yogi supports dynamic arrays:

```ts
let values: number[] = [1, 2, 3]

values.push(4)
print(values[3])
```

Fixed-size arrays:

```ts
let rgb: number[3] = [255, 128, 64]
```

And multidimensional fixed arrays:

```ts
let image: number[2, 2, 3] = [
    [
        [255, 0, 0],
        [0, 255, 0]
    ],
    [
        [0, 0, 255],
        [255, 255, 255]
    ]
]
```

Fixed-size arrays cannot use size-changing methods like `push`, `pop`, `shift`, or `splice`.

---

## Control Flow

Yogi supports familiar control flow syntax:

```ts
function factorial(n: number): number {
    let result: number = 1
    let i: number = 2

    while (i <= n) {
        result = result * i
        i = i + 1
    }

    return result
}

print(factorial(5))
```

Loop conditions must be boolean. Yogi does not use JavaScript truthy or falsy coercion.

```ts
let count: number = 10

// Invalid in Yogi
// if (count) {}

// Valid in Yogi
if (count > 0) {
    print("count is positive")
}
```

---

## Casting

Yogi does not use TypeScript-style `as` casting.

The `as` keyword is reserved for import/export aliasing. Explicit casts use `cast<T>(value)`.

```ts
let value: number = 65
let byte: int8 = cast<int8>(value)
```

Higher-level conversions use constructors or conversion functions:

```ts
let amount: number = 123
let text: string = String(amount)
```

---

## Example Program

```ts
extern audio from "./native/audio.o" {
    normalize(input: string, output: string): void
}

type Track = {
    id: number
    input: string
    output: string
}

function process(track: ptr<Track>): void {
    print(track.input)
    audio.normalize(track.input, track.output)
}

function main(): void {
    let track: Track = {
        id: 1,
        input: "song.wav",
        output: "song-normalized.wav"
    }

    process(&track)
}
```

This example shows several core Yogi ideas together:

- Explicit types.
- Fixed object layout.
- Pointer parameters.
- Native library interop.
- TypeScript-like syntax with native compilation semantics.

---

## Compiler Architecture

Yogi is built as a native compiler pipeline:

```txt
Yogi source
   ↓
TypeScript-like frontend parser
   ↓
Semantic analysis and strict type checking
   ↓
Yogi intermediate representation
   ↓
LLVM backend
   ↓
Native object files / executable
```

The compiler is designed around ahead-of-time compilation, predictable memory behavior, and native binary output.

---

## Project Status

Yogi is under active development.

Current language work includes:

- Strict type checking.
- Arrays and multidimensional arrays.
- Pointer syntax and pointer validation.
- Native `extern` declarations.
- Struct layout and validation design.
- LLVM-backed native compilation.
- Package manager and toolchain workflow.

The language design is intentionally strict: Yogi favors explicitness, predictable behavior, and native compilation over dynamic runtime flexibility.

---

## License

License information will be added here.
