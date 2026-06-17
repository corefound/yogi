# Lot 02: Array Serialization Fix

## Objetivo

Arreglar la serialización de `ArrayDeclaration` en el pipeline FlatBuffers para que las declaraciones de arrays puedan fluir consistentemente desde TypeScript hasta C++.

## Pipeline End-to-End

### 1. Input TypeScript

```typescript
let scores: number[] = [1, 2, 3]

function total(): number {
    let local: number[] = [4, 5, 6]
    return local[0] + local[1]
}
```

### 2. AST (TypeScript Parser)

El parser produce nodos `ArrayDeclaration` para `let scores: number[] = [...]` y `let local: number[] = [...]`. Cada uno contiene:
- `name`: nombre de la variable
- `type`: tipo ArrayType con elementType
- `elements`: array de valores literales
- `flag`: "let" o "const"

### 3. Semantic Analysis (src/compiler/src/semantic/arrays.ts)

```typescript
// VisitArrayDeclarations produce SIR:
{
    kind: "ArrayDeclaration",
    symbolId: symbol.id,
    scopeId: symbol.scopeId,
    mutable: true,
    storage: "stack" | "global",
    escapes: false,
    length: 3,
    linkageName: "_yogi_main_yg__scores",
    qualifiedName: "main.yg:scores",
    flag: "let",
    export: false,
    type: { kind: "ArrayType", elementType: { kind: "NumberType" }, raw: "number[]" },
    trusted: true,
    elements: [NumberConstant(1), NumberConstant(2), NumberConstant(3)]
}
```

### 4. FBS Schema (src/fbs/schemas/sir/sir.fbs)

```fbs
/// Array declaration with inline element initializers.
/// Represents: let name: type[] = [elem1, elem2, ...]
table ArrayDeclaration {
  name:string;
  type:TypeRef;
  elements:[ValueRef];
  symbol_id:int = -1;
  scope_id:int = -1;
  mutable:bool = false;
  storage:string;
  flag:string;
  exported:bool = false;
  trusted:bool = true;
  escapes:bool = false;
  linkage_name:string;
  qualified_name:string;
  source:string;
  position:SourcePosition;
}
```

Agregado a la unión `SirNodeValue` con `ArrayDeclaration = 14`.

### 5. FBS Serialization (src/compiler/src/fbs/sir.ts)

```typescript
static createArrayDeclaration(
    builder: fbs.Builder,
    declaration: Types.Sir.SemanticArrayDeclaration,
): fbs.Offset {
    const name = builder.createString(declaration.name);
    const type = this.createTypeRef(builder, declaration.type);
    const elementOffsets = (declaration.elements ?? []).map(...)
    const elementsVector = createVector(builder, elementOffsets, ...)
    // ... build all fields
    return ArrayDeclaration.endArrayDeclaration(builder);
}
```

### 6. C++ Backend

El FlatBuffer se deserializa en `fbs_generated.h` con `value_as_ArrayDeclaration()` disponible en `SirNode`.

El C++ actualmente maneja arrays globales via `VariableDeclaration` (no `ArrayDeclaration`). El lowering de arrays locales vía `ArrayDeclaration` está pendiente para el próximo lote.

### 7. LLVM Output (global array)

```llvm
@_yogi_main_yg_scores = internal global ptr null

define void @_yogi_module_init_main_yg() {
entry:
  %yogi_array_create.call = call ptr @yogi_array_create(i64 3)
  %yogi_any_from_number.call = call ptr @yogi_any_from_number(double 1.000000e+00)
  call void @yogi_array_set(ptr %yogi_array_create.call, i64 0, ptr %yogi_any_from_number.call)
  ; ... elements 2 and 3 ...
  store ptr %yogi_array_create.call, ptr @_yogi_main_yg_scores, align 8
}

define void @_yogi_module_cleanup_main_yg() {
entry:
  %0 = load ptr, ptr @_yogi_main_yg_scores, align 8
  call void @yogi_array_destroy(ptr %0)
  store ptr null, ptr @_yogi_main_yg_scores, align 8
}
```

## Diagrama de Flujo

```
TypeScript Source
  let scores: number[] = [1, 2, 3]
       │
       ▼
AST Parser (TypeScript)
  └─ ArrayDeclaration
     ├─ name: "scores"
     ├─ type: ArrayType(NumberType)
     └─ elements: [1, 2, 3]
       │
       ▼
Semantic Analysis (arrays.ts)
  └─ visitArrayDeclarations()
     ├─ defineSymbol() → scope/symbolId
     ├─ declarationArrayDiagnostics() → type/trust checks
     └─ returns SIR node
       │
       ▼
SIR (Semantic Intermediate Representation)
  └─ kind: "ArrayDeclaration"
     ├─ symbolId, scopeId, mutable, storage, escapes
     ├─ linkageName, qualifiedName
     ├─ type: ArrayType, elements: [ValueRef...]
       │
       ▼
FBS Serialization (fbs/sir.ts)
  └─ createArrayDeclaration()
     ├─ SirNodeValue.ArrayDeclaration
     └─ Buffer → snode.fb
       │
       ▼
C++ Deserialization (fbs_generated.h)
  └─ SirNode::value_as_ArrayDeclaration()
     ├─ name(), type(), elements()
     ├─ storage(), escapes(), mutable()
       │
       ▼
C++ Lowering (declarationLowerer.cpp) *PENDIENTE*
  └─ lowerArrayDeclaration() / VariableDeclaration path
       │
       ▼
LLVM IR (main.ll)
  └─ yogi_array_create / yogi_array_set / yogi_array_destroy
       │
       ▼
Runtime (yogi_runtime)
  └─ ArrayValue (descriptor + element buffer)
```

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/fbs/schemas/sir/sir.fbs` | Nueva tabla `ArrayDeclaration`, añadido a `SirNodeValue` union |
| `src/compiler/src/types/sir.ts` | Nuevo type `SemanticArrayDeclaration` |
| `src/compiler/src/fbs/sir.ts` | `createArrayDeclaration()`, case en switch, import |
| `src/fbs/generated/yogi/sir/` | Regenerado via `make fbs-build` |
| `libs/flatbuffers/fbs_generated.h` | Regenerado via `make fbs-build` |

## Comandos

```bash
# Regenerar FlatBuffers (TS + C++)
make fbs-build

# Build completo
make build

# Test
make test
```

## Estado

- ✅ Schema FBS actualizado con `ArrayDeclaration`
- ✅ Union `SirNodeValue` incluye `ArrayDeclaration`
- ✅ Código generado (TS + C++) actualizado
- ✅ Serialización implementada en `fbs/sir.ts`
- ✅ Build exitoso
- ✅ Pipeline no crashea con `ArrayDeclaration`
- ⏳ C++ lowering de variables locales con `ArrayDeclaration` (próximo lote)
