# Lot 17: String Expression Temporaries

## Goal

This lot cleans runtime-created strings that are used only as expression
temporaries instead of being assigned to a variable.

```ts
print(("  " + "Temp" + "10" + "  ").trim())
```

The concat operations create runtime strings, `trim()` creates another runtime
string, and `print()` consumes the final value. The compiler now inserts
`yogi_string_destroy` calls after each temporary is consumed.

## Covered Cases

String temporaries are cleaned after:

- `print(stringExpression)`
- string `+` concatenation
- string method receivers such as `("a" + "1").trim()`
- string search arguments such as `"banana".includes("n" + "a")`
- ignored string expression statements such as `"ignored".toUpperCase()`

## Parenthesized Receivers

Semantic analysis now preserves the inner expression type for
`ParenthesizedExpression` outside binary-expression-only paths. This allows
method calls on parenthesized expressions:

```ts
print(("  yogi  ").trim())
print(("a" + "1").trim())
```

## Lowering Rule

The backend destroys only expressions known to create runtime-owned strings.
String literals and identifiers are not destroyed as expression temporaries.

This keeps the rule conservative:

```ts
let text: string = "owned".toUpperCase()
print(text) // does not destroy text here; the local cleanup owns it
```

## Tests

`yogi_pipeline_string_lifetime` now covers:

- direct print of nested string concat + trim
- temporary string search arguments
- ignored string expression statements
- parenthesized string method receivers
- previous local/module string cleanup and `array.at()` extraction coverage

## Remaining Work

Future ownership lots can make this more precise for complex control-flow
temporaries, conditional string expressions, and callback-local temporaries.
