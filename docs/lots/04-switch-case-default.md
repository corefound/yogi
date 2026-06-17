# Lot 04: switch/case/default

## Objetivo

Implementar `switch`/`case`/`default` end-to-end: TypeScript parsing → semantic analysis → FBS serialization → LLVM lowering → runtime executable.

## Decisiones de Diseño

### Lowering: if-else chain (NO LLVM SwitchInst)

- El discriminante en Yogi es `f64` y LLVM SwitchInst solo acepta enteros
- Se usa `FCmpOEQ` (ordered equality) para comparaciones
- NaN nunca matchea ningún case (ordered equality con NaN es false)

### Sin fall-through

- Cada case body termina con un branch implícito a `switch.end`
- No hay ejecución automática del case siguiente
- C/JavaScript fall-through no está soportado

### default debe ser el último

- El semantic analysis rechaza `default` en cualquier posición que no sea la última
- Error: `default clause must be the last clause in a switch statement`

### Un solo default

- Duplicar `default` produce error: `A switch statement can only have one default clause`

### Tipos soportados: solo number (f64)

- El discriminante debe ser `number`
- Cada case expression debe ser `number`
- Error claro si se usan otros tipos

### break dentro de switch

- `break` dentro de un case sale del switch (no del loop contenedor)
- Implementado via `switchFrames` stack en el lowering
- `lowerBreak` checkea `switchFrames` antes de `loopFrames`

### Scope por case body

- Cada case/default body tiene su propio scope para variables locales
- `let arr: number[]` en case 1 y otro `let arr: number[]` en case 2 son válidos
- Implementado via `lowerBlock` que maneja enterScope/exitScope y cleanup

### Cleanup de agregados locales

- Variables declaradas dentro de un case body son destruidas al salir del case
- Cleanup ocurre antes del branch a `switch.end`
- `break` también ejecuta cleanup antes de saltar a `switch.end`

## Pipeline End-to-End

### 1. Source TypeScript

```typescript
function classify(x: number): number {
    let result: number = 0

    switch (x) {
        case 1:
            result = 10
            break

        case 2:
            result = 20
            break

        default:
            result = 99
            break
    }

    return result
}
```

### 2. AST Visitor (`conditional.ts`)

Produce nodos con `kind: Kinds.ControlFlow.SwitchStatement` y clauses con `CaseClause`/`DefaultClause`.

### 3. Semantic Analysis (`if.ts`)

`visitSwitchStatement`:
1. Valida que el discriminante sea `number`
2. Valida que cada case expression sea `number`
3. Valida que no haya duplicate default
4. Valida que default sea el último
5. Visita cada clause body como BlockStatement (scope local)
6. Incrementa/decrementa `switchDepth` para permitir `break`

### 4. FBS Schema (`sir.fbs`)

```flatbuffers
table CaseClause {
    expression: ValueRef;
    body: BlockStatement;
    source: string;
    position: SourcePosition;
}

table DefaultClause {
    body: BlockStatement;
    source: string;
    position: SourcePosition;
}

table SwitchStatement {
    expression: ValueRef;
    clauses: [SirNode];
    source: string;
    position: SourcePosition;
}
```

### 5. LLVM IR Generado

```
switch.check0:
    %switch.cmp0 = fcmp oeq double %x, 1.0
    br i1 %switch.cmp0, label %switch.case0.body, label %switch.check1

switch.check1:
    %switch.cmp1 = fcmp oeq double %x, 2.0
    br i1 %switch.cmp1, label %switch.case1.body, label %switch.default.body

switch.case0.body:
    ... body ...
    br label %switch.end

switch.case1.body:
    ... body ...
    br label %switch.end

switch.default.body:
    ... body ...
    br label %switch.end

switch.end:
    ... merge ...
```

### 6. C++ Lowering (`statementLowerer.cpp`)

`lowerSwitch` crea una cadena de if-else:
- Entry bloque → branch a `switch.check0`
- Cada `switch.checkN` compara discriminant == case value con `FCmpOEQ`
- Match → branch a `switch.caseN.body`
- No match → branch a siguiente check / default body / switch.end
- Cada case body se baja via `lowerBlock` (scope/cleanup automático)
- Si el body no termina con terminator → branch a switch.end
- Si el default no existe → último check branch a switch.end

## Tests

| Test | Cobertura |
|------|-----------|
| `pipeline_switch` | Compilación: IR contiene `switch.check0`, `switch.case0.body`, `switch.end`, `fcmp oeq` |
| `pipeline_switch` | Ejecución: binario corre sin error |
| `pipeline_switch` | 3 funciones: con default, sin default, con break |
