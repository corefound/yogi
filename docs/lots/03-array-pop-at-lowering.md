# Lot 03: Runtime Array Lowering (pop, at)

## Objetivo

Completar el pipeline de runtime y LLVM lowering para `array.pop()` y `array.at(i)`, que estaban analizados semánticamente pero no bajados a LLVM.

## Gap Original

| Feature | Semantic Analysis | LLVM Lowering | Runtime |
|---------|:-:|:-:|:-:|
| `array.push(x)` | ✅ | ✅ | ✅ `yogi_array_push` |
| `array.pop()` | ✅ | ❌ | ❌ |
| `array.at(i)` | ✅ | ❌ | ❌ |
| `array.length` | ✅ | ✅ (propiedad) | ❌ (se evalua en compile-time) |

## Pipeline

### 1. Source

```typescript
function last(): number | undefined {
    let scores: number[] = [10, 20, 30]
    return scores.pop()
}

function getAt(i: number): number | undefined {
    let scores: number[] = [10, 20, 30]
    return scores.at(i)
}
```

### 2. Semantic Analysis

`validateAndCreatePopCall` en `src/compiler/src/semantic/expressions.ts` produce:

```typescript
{
    kind: "CallExpression",
    builtinMethod: "array.pop",    // ← tag que identifica el método
    arguments: [],                  // pop() no toma args
    type: { kind: "UnionType", types: [elementType, "undefined"] },
    ...
}
```

`validateAndCreateAtCall` produce:

```typescript
{
    kind: "CallExpression",
    builtinMethod: "array.at",     // ← tag
    arguments: [indexExpr],         // at(i) toma un index
    type: { kind: "UnionType", types: [elementType, "undefined"] },
    ...
}
```

### 3. FBS Serialization

El `builtinMethod` se serializa como string en `CallExpression.builtin_method`. El C++ lo lee como `call->builtin_method()`.

### 4. C++ Lowering (`valueLowerer.cpp`)

`lowerBuiltinMethodCall` despacha en `methodName`:

```
"push"  → yogi_array_push(array, boxedValue)    → i64 → f64
"pop"   → yogi_array_pop(array)                 → AnyValue*
"at"    → yogi_array_at(array, toIndex(index))  → AnyValue*
```

#### array.pop()

```cpp
if (methodName == "pop") {
    auto *array = lower(callee->object(), opaquePointer(), ...);
    auto *result = callRuntime("yogi_array_pop", opaquePointer(), {array});
    return cast(result, expectedType, expectedSemanticType, call->type());
}
```

No boxing needed - `yogi_array_pop` ya devuelve `AnyValue*` (boxed). El `cast` a `T | undefined` es un no-op pues ambos son `opaquePointer`.

#### array.at(i)

```cpp
if (methodName == "at") {
    auto *array = lower(callee->object(), opaquePointer(), ...);
    auto *argumentValue = lower(argument, f64, ...);
    auto *result = callRuntime("yogi_array_at", opaquePointer(), {array, toIndex(argumentValue)});
    return cast(result, expectedType, expectedSemanticType, call->type());
}
```

El índice se convierte de `f64` → `i64` via `toIndex()` (CreateFPToUI).

### 5. LLVM IR Generado

Para `scores.pop()`:

```llvm
%scores.load = load ptr, ptr %scores, align 8
%yogi_array_pop.call = call ptr @yogi_array_pop(ptr %scores.load)
ret ptr %yogi_array_pop.call
```

Para `scores.at(i)`:

```llvm
%scores.load = load ptr, ptr %scores, align 8
%yogi_array_at.call = call ptr @yogi_array_at(ptr %scores.load, i64 %numtoindextmp)
ret ptr %yogi_array_at.call
```

### 6. Runtime (`aggregate.cpp`)

#### yogi_array_pop

```cpp
void *ArrayValue::pop() {
    // Si vacío → undefined
    if (elementCount == 0) return AnyValue::undefined();
    // Decrementar count, devolver último elemento
    --elementCount;
    auto *result = elements[elementCount];
    elements[elementCount] = AnyValue::undefined();
    return result ? result : AnyValue::undefined();
}
```

#### yogi_array_at

```cpp
void *ArrayValue::at(std::size_t index) const {
    // Si out-of-range → undefined
    if (index >= elementCount) return AnyValue::undefined();
    return elements[index] ? elements[index] : AnyValue::undefined();
}
```

## Cleanup

El array descriptor se limpia normalmente via `yogi_array_drop` al final de su lifetime. `pop()` y `at()` no afectan el descriptor, solo mutan/leen el buffer interno.

Ejemplo de LLVM con cleanup:

```llvm
%yogi_array_pop.call = call ptr @yogi_array_pop(ptr %scores.load)
call void @yogi_array_drop(ptr %scores.array.storage)
ret ptr %yogi_array_pop.call        ; pop value returned AFTER drop
```

## Nota sobre ArrayDeclaration

El schema FBS contiene una tabla `ArrayDeclaration` pero el compilador TypeScript nunca la emite. Todas las declaraciones de arrays (incluso `let scores: number[] = [1, 2, 3]`) se serializan como `VariableDeclaration` con un `ValueRef → ArrayExpression`. El C++ las baja via `lowerVariable` → `values.lower()` → `lowerArray()`. La tabla `ArrayDeclaration` en FBS es código muerto.

## Out of Scope

- `switch`/`case`
- `do..while`
- `for..of` / `for..in`
- Destructuring avanzado
- `function` expression
- Full JavaScript Array behavior (no prototype, no holes, no coercions)

## Tests

| Test | Coverage |
|------|----------|
| `runtime_cast_test` | `yogi_array_pop` en runtime C++: pop devuelve elementos en orden inverso, pop en vacío devuelve undefined |
| `runtime_cast_test` | `yogi_array_at` en runtime C++: at devuelve elemento en rango, at fuera de rango devuelve undefined |
| `pipeline_loops_and_methods` | Compilación end-to-end: IR contiene `yogi_array_pop` y `yogi_array_at`, ejecutable corre sin error |
