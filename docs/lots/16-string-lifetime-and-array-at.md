# Lot 16: String Lifetime And Array At Extraction

## Goal

This lot starts treating runtime-created strings as resources and fixes a
semantic/lowering gap for `array.at(index)` when the index is known to be valid.

```ts
let text: string = "  Yogi  ".trim()
print(text)
```

The string returned by `trim()` is allocated by the runtime. Yogi now schedules
cleanup for local string variables and module string bindings through
`yogi_string_destroy`.

## Runtime String Ownership

Runtime string helpers register the pointers they allocate:

- `yogi_string_at`
- `yogi_string_concat`
- `yogi_string_slice`
- `yogi_string_substring`
- `yogi_string_to_upper_case`
- `yogi_string_to_lower_case`
- `yogi_string_trim`

`yogi_string_destroy(value)` only frees strings known to be runtime-owned.
String literals and other non-owned pointers are ignored safely.

## Cleanup Scheduling

Local `string` variables now get cleanup slots:

```ts
function run(): void {
    let text: string = "  Yogi  ".trim()
    print(text)
}
```

At scope exit, LLVM emits `yogi_string_destroy(text)`.

Reassignment destroys the previous value when it was runtime-owned:

```ts
let text: string = "literal"
text = "Next".toLowerCase()
```

The literal is ignored by `yogi_string_destroy`, and the runtime-created
replacement is cleaned later by the local cleanup slot.

Module-level strings are cleaned in module cleanup:

```ts
let globalText: string = "  Global  ".trim()
```

## Array At Extraction

`array.at(index)` still returns `T | undefined` for dynamic indexes. When the
receiver length and literal index are known at compile time, semantic analysis
narrowing now returns `T`:

```ts
let values: number[] = [3, 1, 20]
let first: number = values.at(0)
let last: number = values.at(-1)
```

This compiles and lowers to `yogi_array_at_index` plus `yogi_any_to_number`.

Out-of-range literal indexes still keep the safe union type:

```ts
let missing: number = values.at(3)
```

That remains rejected because the expression can be `undefined`.

## Tests

`yogi_runtime_string_test` covers runtime-owned string destroy and no-op literal
destroy.

`yogi_pipeline_string_lifetime` covers:

- local runtime-created string cleanup
- local string reassignment cleanup
- module/global runtime-created string cleanup
- literal string cleanup no-op behavior
- `array.at(0)` and `array.at(-1)` extraction into `number`
- out-of-range `array.at(3)` staying as `number | undefined`

## Known Limitations

Assigned string values and module bindings are covered in this lot. Expression
temporary cleanup is covered by the follow-up string temporary lot.
