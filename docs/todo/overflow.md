# Integer Overflow en Yogi

## Objetivo

Yogi debe manejar el integer overflow de forma segura, predecible y eficiente.

La regla principal es:

> **La aritmética entera ordinaria de Yogi nunca debe producir wrapping silencioso ni undefined behavior.**

Cuando una operación entera exceda el rango válido de su tipo de evaluación:

- si el compiler puede demostrar el overflow durante compilación, debe producir un **compile-time error**;
- si el resultado depende de valores runtime, debe existir una **runtime overflow check**;
- si el compiler puede demostrar que el overflow es imposible, debe eliminar el check;
- si ocurre overflow durante runtime, Yogi debe producir un **`IntegerOverflowError`**.

Esta política debe ser consistente en todos los modos de compilación. Un programa no debe cambiar su semántica entre debug y release.

---

## 1. Modelo numérico de Yogi

Yogi hereda la semántica general de `number` de TypeScript y JavaScript.

Por defecto:

```ts
let value: number = 10
```

`number` se representa como un `double`.

Esto significa que Yogi no necesita declarar como tipos built-in del lenguaje una lista fija como:

```text
int8
int16
int32
int64
int128
```

Los tipos numéricos de representación específica se crean mediante `struct` y `layout()`.

Ejemplo conceptual:

```ts
struct int32 extends number {
    layout(): IntegerLayout {
        return {
            size: 32,
            signed: true
        }
    }

    validate(): boolean {
        return this >= -2147483648 &&
               this <= 2147483647 &&
               this % 1 == 0
    }
}
```

En este modelo:

```text
number
    → tipo numérico general de Yogi
    → representación double

struct con IntegerLayout
    → custom numeric type
    → representación entera entendida por LLVM

struct con FloatLayout
    → custom numeric type
    → representación floating-point específica
```

El lenguaje base no necesita imponer nombres concretos como `int8`, `int16` o `int64`.

El developer, una librería estándar o el propio ecosistema de Yogi puede definir esos tipos utilizando layouts compatibles con LLVM.

La política de overflow descrita en este documento aplica a cualquier custom numeric type cuyo `layout()` produzca un `IntegerLayout`.

Por tanto:

```ts
let value: number = ...
```

utiliza semántica de `double`.

Mientras:

```ts
let value: int32 = ...
```

utiliza la semántica entera definida por el `IntegerLayout` de ese custom type.

---

## 2. Regla fundamental de overflow

Cada operación entera debe producir un resultado válido dentro del rango de evaluación correspondiente.

Ejemplo:

```ts
function multiply(a: int32, b: int32): int32 {
    return a * b
}
```

Si los valores reales son:

```text
a = 2_000_000_000
b = 2
```

la multiplicación excede el rango de `int32`.

Yogi no debe:

- hacer wrapping silencioso;
- producir un valor corrupto;
- continuar con undefined behavior;
- cambiar el comportamiento entre debug y release.

Debe producir:

```text
IntegerOverflowError
```

---

## 3. Overflow en expresiones intermedias

El overflow también se considera un error cuando ocurre dentro de una subexpresión.

Ejemplo:

```ts
let result: int32 = (a * b) / 2
```

Supongamos:

```text
a = 2_000_000_000
b = 2
```

Matemáticamente:

```text
(2_000_000_000 * 2) / 2
= 2_000_000_000
```

El resultado matemático final cabe en `int32`.

Sin embargo, si la operación:

```ts
a * b
```

se evalúa dentro de un rango donde el resultado no puede representarse, ocurre overflow antes de ejecutar la división.

La política de Yogi es:

> **Una subexpresión debe producir un valor válido antes de que la siguiente operación pueda utilizarlo.**

Por tanto:

```text
a * b
↓
overflow
↓
IntegerOverflowError
```

Yogi no debe introducir automáticamente `BigInt`, integers de tamaño arbitrario ni temporales multiprecisión invisibles para intentar rescatar una expresión que ya produjo overflow.

Esta regla mantiene la semántica:

- local;
- predecible;
- eficiente;
- fácil de optimizar;
- apropiada para un systems language.

---

## 4. Detección durante compile time

Cuando el compiler puede demostrar que una operación producirá overflow, debe rechazar el programa durante compilación.

Ejemplo:

```ts
let value: int8 = 120 + 20
```

El compiler conoce los valores:

```text
120 + 20 = 140
```

Y conoce el rango de `int8`:

```text
-128 ... 127
```

Por tanto, debe producir un error de compilación.

Ejemplo conceptual:

```text
IntegerOverflowError:
The expression evaluates to 140,
which cannot be represented by int8.
```

No existe razón para generar un ejecutable que inevitablemente fallará.

---

## 5. Detección durante runtime

Cuando el compiler no conoce los valores reales, debe generar una operación checked.

Ejemplo:

```ts
function add(a: int32, b: int32): int32 {
    return a + b
}
```

El compiler no sabe qué valores recibirá la función.

Conceptualmente, Yogi genera:

```text
result, overflow = checkedAdd(a, b)

if overflow:
    raise IntegerOverflowError

return result
```

Lo mismo aplica a operaciones como:

```text
addition
subtraction
multiplication
negation
division en casos especiales
power
conversion entre integer types
```

La implementación concreta puede utilizar las capacidades de LLVM y del target para producir la secuencia más eficiente posible.

---

## 6. Eliminación de checks innecesarios

Yogi no debe mantener runtime checks cuando el compiler puede demostrar que una operación es segura.

Ejemplo:

```ts
function increment(value: int32): int32 {
    if (value < 100) {
        return value + 1
    }

    return value
}
```

Dentro de la rama:

```ts
if (value < 100)
```

el semantic analysis sabe que:

```text
value <= 99
```

Por tanto:

```text
value + 1 <= 100
```

El resultado siempre cabe en `int32`.

Yogi puede generar una suma normal sin runtime overflow check.

La regla es:

```text
seguridad demostrada
    → operación directa

overflow demostrado
    → compile-time error

resultado desconocido
    → checked runtime operation
```

---

## 7. Análisis automático de rangos

El usuario no debe declarar rangos manualmente para obtener estas optimizaciones.

Yogi puede obtener información automáticamente desde:

- el `IntegerLayout` del tipo;
- valores constantes;
- condiciones `if`;
- comparaciones;
- control flow;
- validaciones conocidas;
- conversiones;
- tipos de parámetros;
- tipos de retorno;
- información producida por semantic analysis.

Ejemplo:

```ts
function calculate(a: int8, b: int8): int16 {
    return a * b
}
```

Yogi conoce automáticamente:

```text
a ∈ [-128, 127]
b ∈ [-128, 127]
```

Puede determinar que el producto completo cabe dentro de `int16`.

El developer no necesita escribir información adicional.

---

## 8. Ancho de evaluación y eficiencia

El tipo de almacenamiento de una variable y el ancho físico utilizado para ejecutar una operación no tienen que ser exactamente iguales.

Ejemplo:

```ts
let a: int8 = ...
let b: int8 = ...
let result: int16 = a * b
```

El compiler puede determinar que el resultado matemático cabe en `int16`.

Sin embargo, el backend puede decidir ejecutar la operación usando registros de 32 bits si eso es más eficiente en el target.

Se deben separar estos conceptos:

```text
Storage Type
    Tipo real declarado por el programa.

Semantic Range
    Rango de valores válidos del tipo.

Evaluation Strategy
    Forma más eficiente de ejecutar la operación.

Materialization
    Momento en que el resultado se valida y almacena.
```

El backend puede utilizar el ancho más eficiente siempre que preserve exactamente la semántica definida por Yogi.

---

## 9. Potencia

La operación de potencia también debe respetar la política de overflow.

Ejemplo:

```ts
function power(base: int64, exponent: uint32): int128 {
    return base ** exponent
}
```

Si el resultado cabe en `int128`, la operación termina normalmente.

Si durante la evaluación una multiplicación necesaria excede el rango permitido, Yogi produce:

```text
IntegerOverflowError
```

La implementación debe utilizar un algoritmo eficiente, como exponentiation by squaring, junto con multiplicaciones checked.

Conceptualmente:

```text
result = 1
factor = base
remaining = exponent

while remaining > 0:
    if remaining is odd:
        result = checkedMultiply(result, factor)

    remaining >>= 1

    if remaining > 0:
        factor = checkedMultiply(factor, factor)
```

Si `checkedMultiply` detecta overflow:

```text
IntegerOverflowError
```

El runtime no necesita construir primero un número gigantesco para descubrir que no cabe.

---

## 10. Constantes y potencia

Cuando todos los valores son conocidos durante compilación:

```ts
let value: int128 = 2 ** 200
```

el compiler puede determinar que el resultado no cabe en `int128`.

Debe producir un compile-time error.

Cuando sí cabe:

```ts
let value: int128 = 2 ** 100
```

el compiler puede resolver la expresión durante constant folding y generar directamente el valor correspondiente.

La precisión interna utilizada por el compiler para evaluar constantes es una implementación interna y no cambia los tipos runtime del lenguaje.

---

## 11. Wrapping explícito

Algunos algoritmos necesitan wrapping deliberadamente.

Ejemplos:

- hashing;
- criptografía;
- ciertos algoritmos bitwise;
- generadores pseudoaleatorios;
- operaciones modulares.

Yogi puede soportar wrapping, pero nunca debe ser el comportamiento accidental de los operadores aritméticos normales.

La aritmética ordinaria:

```ts
a + b
a - b
a * b
```

debe ser checked.

El wrapping debe requerir una operación explícita, por ejemplo:

```ts
wrappingAdd(a, b)
wrappingSub(a, b)
wrappingMultiply(a, b)
```

La sintaxis exacta puede decidirse por separado.

La regla importante es:

> **Wrapping debe ser una decisión explícita del developer.**

---

## 12. Debug y Release

La semántica de overflow no debe depender del modo de compilación.

Esto debe ser incorrecto:

```text
Debug:
    overflow → error

Release:
    overflow → wrapping
```

Yogi debe garantizar:

```text
Debug:
    overflow → IntegerOverflowError

Release:
    overflow → IntegerOverflowError
```

La diferencia entre builds puede estar en las optimizaciones, no en el significado del programa.

Si el compiler demuestra que un check es innecesario, puede eliminarlo tanto en debug como en release según las reglas de optimización aplicables.

---

## 13. Integración con `validate()`

Los checks de overflow y `validate()` cumplen responsabilidades diferentes.

Ejemplo:

```ts
struct Percentage extends int32 {
    validate(): boolean {
        return this >= 0 && this <= 100
    }
}
```

Para:

```ts
let result: Percentage = a + b
```

el orden conceptual es:

```text
1. Ejecutar la operación aritmética correctamente.
2. Detectar integer overflow si ocurre.
3. Materializar el resultado como el integer base.
4. Ejecutar validate().
5. Guardar el valor si la validación pasa.
```

`validate()` no debe ser responsable de detectar un overflow que ya corrompió el resultado.

La protección contra overflow pertenece a la semántica de la aritmética entera.

La validación del dominio pertenece al tipo definido por el developer.

---

## 14. Integración con LLVM

El backend de Yogi puede utilizar las operaciones e intrinsics de LLVM para implementar checked arithmetic eficientemente.

Conceptualmente:

```text
checked add
checked subtract
checked multiply
```

El resultado incluye:

```text
value
overflow flag
```

Si el flag indica overflow:

```text
branch → IntegerOverflowError
```

Si no:

```text
continue
```

LLVM puede optimizar estos checks y utilizar las instrucciones apropiadas para cada arquitectura.

Cuando semantic analysis o las optimizaciones demuestren que el overflow es imposible, el check puede eliminarse.

---

## 15. Política final de Yogi

La política oficial propuesta es:

```text
1. `number` continúa siendo un `double`, igual que en TypeScript y JavaScript.

2. Los integers fixed-width no son tipos built-in obligatorios de Yogi;
   se crean mediante custom structs con `IntegerLayout`.

3. Todo custom type con `IntegerLayout` tiene un rango definido por su
   tamaño y signedness.

4. La aritmética de custom types con `IntegerLayout` nunca produce
   wrapping silencioso por defecto.

5. Signed integer overflow nunca produce undefined behavior.

6. Si el overflow es demostrable durante compilación:
       compile-time error.

7. Si el compiler demuestra que el overflow es imposible:
       operación directa sin runtime check.

8. Si el resultado depende de valores runtime:
       checked arithmetic.

9. Si ocurre overflow durante runtime:
       IntegerOverflowError.

10. El overflow de una subexpresión es un error en ese punto.

11. El resultado final no rescata una subexpresión que ya produjo overflow.

12. Yogi no introduce BigInt o multiprecisión invisible para rescatar
    expresiones fixed-width.

13. Wrapping, si se soporta, debe ser explícito.

14. La semántica debe ser idéntica en debug y release.

15. El compiler y LLVM deben eliminar checks cuando puedan demostrar
    que son innecesarios.
```

---

## Resumen

Yogi debe utilizar una estrategia de **checked integer arithmetic por defecto**.

La filosofía es:

```text
Detectar temprano cuando sea posible.
Proteger en runtime cuando sea necesario.
Eliminar checks cuando se demuestre seguridad.
Nunca corromper silenciosamente un resultado.
Nunca depender de undefined behavior.
Nunca hacer wrapping accidental.
```

La garantía para el developer es simple:

> **Una operación entera en Yogi produce un resultado válido o produce un error definido. Nunca produce silenciosamente un integer corrupto debido a overflow.**
