# Lot 71: Mutable Native String ABI Ownership Policy

This lot defines the ownership model for mutable strings crossing the Native
ABI. It does not implement `ptr<string[]>`.

The purpose is to avoid guessing at copy-back behavior before Yogi has a clear
contract for who owns native string memory.

## Principle

`ptr<string[]>` is not the primitive design decision. It is a consequence of
the Native ABI string ownership policy.

Yogi strings remain Yogi-owned values. Native strings are temporary boundary
values unless an ABI shape explicitly says otherwise.

## String ABI Modes

| Mode | Yogi Surface | Native Shape | Ownership |
|---|---|---|---|
| Input | `string` / `string[]` | `const char*` / `const char** + length` | Yogi owns. Native borrows read-only. |
| Output | future explicit output string API | `char** out` or return-owned handle | Native produces new text. Yogi copies/adopts by rule. |
| In/Out | future explicit mutable string API | `char** values + length` or descriptor | Native may replace entries only through an owned-output rule. |

The current implemented mode is input-only `string[]`.

## Input Strings

Input strings are read-only borrows.

```ts
extern dictionary from "./libdictionary.a" {
    lookup(words: string[]): number
}
```

Native C receives:

```c
double lookup(const char **words, uint64_t length);
```

Rules:

- Native may read the strings during the call.
- Native must not mutate the pointed-to bytes.
- Native must not free the pointers.
- Native must not retain the pointers after the function returns.
- Yogi destroys the temporary native buffer after the call.
- The original Yogi `string[]` is unchanged.

## Output Strings

Output strings are not implemented yet.

The future policy should require an explicit ABI shape where ownership of the
native-produced memory is clear. Two acceptable directions are:

```c
bool read_name(char **out_value);
void yogi_native_string_free(char *value);
```

or:

```c
YogiNativeString read_name(void);
```

Rules to preserve:

- Native-created text must have a declared owner.
- The free function or ownership handle must be part of the ABI contract.
- Yogi must copy into a Yogi-owned string or adopt through a runtime-owned
  handle.
- Native memory must be released exactly once.
- Returning raw `char*` without an ownership/free rule is invalid.

## In/Out Strings

In/out strings are not implemented yet.

`ptr<string[]>` would mean native code can observe the old values and may
replace entries with new native strings. That requires more than a pointer to
temporary text.

Future in/out behavior must define:

- whether native may replace individual string entries
- how replaced text is allocated
- which function frees replaced native text
- when Yogi copies native text back into Yogi strings
- what happens if native writes `nullptr`
- what happens if native writes the same pointer it received

The recommended first supported in/out contract is:

```c
void normalize_names(char **values, uint64_t length);
```

with an extern-level or library-level declaration that native writes are either:

- borrowed pointers that Yogi copies before return and does not free, or
- owned pointers that Yogi copies/adopts and frees with a declared native free
  function.

Until that choice exists in the source syntax/metadata, `ptr<string[]>` remains
rejected.

## Different Length Replacement

If native replaces a string with text of a different length, Yogi should not
try to mutate the existing Yogi string buffer in place.

Copy-back must create a new Yogi string value for that array slot:

```txt
old Yogi string slot -> replaced with new Yogi-owned string
```

Pointer identity rules:

- Pointers to the array slot remain tied to the slot identity.
- The string value inside the slot may be replaced.
- Pointers directly into string bytes are not part of the current language
  model and must not be exposed.

## Freeing Native Buffers

Yogi may only free native string memory when the ABI declares that Yogi owns it
or gives Yogi a matching free function.

Invalid contracts:

```c
char *make_name(void);          // no free rule
void update(char **values);     // no rule for ownership of replacements
```

Valid future contracts should look more like:

```c
char *make_name(void);
void free_name(char *value);
```

or:

```c
YogiNativeString make_name(void);
void yogi_native_string_destroy(YogiNativeString value);
```

## Current Compiler Rule

For now:

- `string[]` by value is supported as input-only.
- `ptr<string[]>` is rejected.
- `string[][]` is rejected.
- native functions returning `string[]` are rejected.
- native variables of type `string[]` are rejected.
- structs containing `string[]` across Native ABI are rejected.

## Acceptance Criteria For Future `ptr<string[]>`

Before enabling `ptr<string[]>`, Yogi needs:

- syntax or metadata to identify the native string ownership mode
- copy-back rules for replaced entries
- `nullptr` handling
- free-function or owned-handle support for native-owned outputs
- tests for shorter, longer, empty, null, unchanged, and replaced strings
- runtime diagnostics for invalid ownership contracts in debug mode

## Next

The next implementation lot should consume the `@abi` ownership metadata in the
backend/runtime, or keep `ptr<string[]>` rejected and move to another ABI-safe
feature such as nested/resource-owning struct ABI policy.
