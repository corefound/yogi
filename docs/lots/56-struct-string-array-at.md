# Lot 56 - Struct-Held `string[]` `.at()` Extraction

This lot closes direct string extraction from array fields stored inside
struct/object values.

Before this lot, `.at()` could narrow a local literal array:

```ts
let songs: string[] = ["intro", "outro"]
let first: string = songs.at(0)
```

But the same pattern through a struct field still fell back to
`string | undefined` because the compiler only knew the root object, not the
literal array stored at the field path.

Now semantic analysis follows known aggregate literal paths:

```ts
struct Playlist {
    songs: string[]
}

struct Shelf {
    playlist: Playlist
}

let shelf: Shelf = {
    playlist: {
        songs: ["first", "second"]
    }
}

let song: string = shelf.playlist.songs.at(1)
```

The compiler can prove that `songs.at(1)` is in bounds, so the result narrows
to `string` and lowers to LLVM as a string extraction from the runtime array.

## Boundaries

The narrowing is intentionally proof-based:

```ts
let first: string = playlist.songs.at(0)      // OK when songs literal length proves index 0
let last: string = playlist.songs.at(-1)      // OK when literal length proves the negative index
let miss: string = playlist.songs.at(99)      // error: string | undefined
let item: string = playlist.songs.at(index)   // error: string | undefined
```

Dynamic indexes still produce `T | undefined` and require explicit narrowing or
an explicit cast.

## Implementation

`arrayLiteralLength()` now resolves aggregate literal values through:

```txt
identifier
property access
literal element access
```

That lets `.at()` reuse the existing literal-length narrowing for paths such as:

```txt
playlist.songs
shelf.playlist.songs
```

No FlatBuffers schema change was needed.

## Tests

```txt
yogi_pipeline_array_struct_string_at
```

The test covers:

```txt
✅ direct struct field string[] .at() without cast
✅ inherited/interface struct field string[] .at() without cast
✅ nested struct field string[] .at() without cast
✅ parameter field .at() remains string | undefined unless cast
✅ out-of-range literal index is rejected for direct string assignment
✅ dynamic index is rejected for direct string assignment
✅ LLVM IR contains struct lowering plus yogi_array_at_index/yogi_any_to_string
```
