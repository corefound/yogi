# Lot 70: String Array Native ABI

This lot adds read-only `string[]` marshalling across the Native ABI.

## Implemented

- `string[]` extern parameters are supported for `extern native` calls.
- The ABI shape is:

```txt
string[] -> const char** data, uint64_t length
```

- Yogi materializes a temporary native string buffer only while the native
  function is executing.
- Each Yogi string element is copied into temporary native text storage.
- The temporary `const char**` and copied text are destroyed immediately after
  the native call returns.
- The original Yogi `string[]` is never modified or replaced.
- Normal Yogi function calls do not perform this conversion.

## Example

```ts
extern dictionary from "./libdictionary.a" {
    lookupWord(words: string[]): number
}

const words: string[] = [
    "apple",
    "banana",
    "orange"
]

print(dictionary.lookupWord(words))
print(words.length)
print(words[0])
```

Native C sees:

```c
double lookupWord(const char **words, uint64_t length);
```

## Ownership Rule

Native code may read the strings but must not:

- mutate them
- free them
- retain any pointer after the call returns

The temporary buffer belongs to the Yogi runtime.

## Rejected For Now

- `ptr<string[]>`
- `string[][]`
- native functions returning `string[]`
- native variables of type `string[]`
- structs containing `string[]` crossing Native ABI

## Tests

- `tests/runtime/sessions/02-variables-aggregates/array_native_abi_policy.cmake`
- `tests/programs/native_dictionary_lookup.cmake`
- compiler frontend extern ABI tests

## Next

Mutable string arrays are blocked on an explicit ownership policy. See
`docs/lots/71-mutable-native-string-abi-policy.md`.
