# Lot 63: Tagged User Cleanup Program Test

## Goal

Add a real Program Test that uses the current array, pointer, struct, string,
loop, and runtime systems together in a short user-like program.

This lot exists because focused feature tests are not enough by themselves.
Yogi should also keep growing small complete programs that look like code a
developer would actually write.

## Program

The new program models a small tagged user list:

```ts
struct User {
    id: number
    name: string
    tag: string
    score: number
    active: boolean
}

function boostTag(users: ptr<User[]>, tag: string, bonus: number): void {
    for (let user: ptr<User> of users) {
        if (user.active && user.tag == tag) {
            user.score = user.score + bonus
        }
    }
}
```

It then removes inactive users, counts tagged users, checks scores, pushes a new
user, and boosts a second tag.

## Coverage

- `ptr<User[]>` function parameters
- `for...of` by pointer over `ptr<User[]>`
- `for...of` by value over `ptr<User[]>`
- `.length` on pointer arrays
- struct field mutation through array element pointers
- string equality for tag matching
- boolean negation in loop logic
- dynamic array `splice`
- dynamic array `push`
- function calls, loops, early returns, and prints
- LLVM IR generation, object generation, final linking, and runtime execution

## Test

The CTest entry is:

```txt
yogi_program_tagged_user_cleanup
```

The test lives at:

```txt
tests/programs/tagged_user_cleanup.cmake
```

## Expected Output

```txt
4
2
2
2
85
95
1
80
```

## Notes

Program Tests should be added when a coherent scenario exists. They do not need
to wait until an entire language area is 100 percent finished.
