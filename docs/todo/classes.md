# Yogi Classes, Inheritance, Pointers, Escape Analysis and Lifetime Rules

This document records the current design direction for Yogi class semantics, especially:

- `extends`
- `inherits`
- `inherit`
- `super`
- `abstract`
- `override`
- inherited aliases
- `pointer<T>`
- `.ref`
- escape analysis
- heap promotion
- lifetime anchors
- automatic destruction

Yogi should feel familiar to TypeScript on the surface, but it should have stricter and more predictable compiled-language semantics.

---

## 1. Class Inheritance Overview

Yogi supports two different inheritance modes:

```ts
class Admin extends User {
}
```

and:

```ts
class Customer inherits Identifiable, Timestamped {
}
```

They are not the same.

```txt
extends
    Single inheritance.
    TypeScript-like.
    Uses super.

inherits
    Multiple class inheritance.
    Yogi-specific.
    Does not use super.
    Uses inherit Base(...) inside the constructor.
```

---

## 2. `extends`

`extends` is used for normal single inheritance.

```ts
class User {
    id: string

    constructor(id: string) {
        this.id = id
    }

    name(): string {
        return "user"
    }
}

class Admin extends User {
    constructor(id: string) {
        super(id)
    }

    override name(): string {
        return "admin"
    }
}
```

Rules:

```txt
1. `extends` accepts one parent class.
2. `super(...)` is valid only in classes that use `extends`.
3. `super.method()` is valid only in classes that use `extends`.
4. If a child redefines an inherited method, `override` is required.
```

---

## 3. `inherits`

`inherits` is used for multiple class inheritance.

```ts
class Customer inherits Identifiable, Timestamped {
}
```

The class inherits members from both bases.

```txt
`inherits` declares multiple inherited classes.
It does not decide conflicts by order.
If two bases define the same visible method or field, the child must resolve it explicitly.
```

Example:

```ts
class Identifiable {
    id: string

    constructor(id: string) {
        this.id = id
    }

    peek(): string {
        return this.id
    }
}

class Timestamped {
    createdAt: Date

    constructor(createdAt: Date) {
        this.createdAt = createdAt
    }

    peek(): string {
        return this.createdAt.toString()
    }
}

class Customer inherits Identifiable, Timestamped {
    email: string

    constructor(id: string, email: string, createdAt: Date) {
        inherit Identifiable(id) as private identifiable
        inherit Timestamped(createdAt) as private timestamped

        this.email = email
    }

    override peek(): string {
        return this.identifiable.peek() + " | " + this.timestamped.peek()
    }
}
```

---

## 4. `super` Is Illegal Inside `inherits`

In a class that uses `inherits`, all uses of `super` are illegal.

Invalid:

```ts
class Customer inherits Identifiable, Timestamped {
    constructor(id: string, createdAt: Date) {
        super(id) // error
    }

    update(): void {
        super.update() // error
    }
}
```

Reason:

```txt
`super` assumes one clear parent.
`inherits` can have multiple bases.
Therefore `super` is ambiguous and must be prohibited.
```

Rules:

```txt
1. `super` is a reserved keyword.
2. `super` is valid only in classes using `extends`.
3. `super` is completely illegal in classes using `inherits`.
4. This includes:
   - super(...)
   - super.method()
   - super.property
```

---

## 5. `inherit` Inside Constructor

A class using `inherits` must initialize every inherited base explicitly with `inherit`.

```ts
class Customer inherits Identifiable, Timestamped {
    constructor(id: string, createdAt: Date) {
        inherit Identifiable(id) as private identifiable
        inherit Timestamped(createdAt) as private timestamped
    }
}
```

Rules:

```txt
1. `inherit` is a reserved keyword.
2. `inherit` is only valid inside a constructor.
3. `inherit` is only valid in a class using `inherits`.
4. `inherit` must appear at the beginning of the constructor.
5. All `inherit` statements must come before normal constructor logic.
6. `this` cannot be used before all inherited bases are initialized.
7. Each inherited base must be initialized exactly once.
8. The order of `inherit` must match the order of `inherits`.
9. `inherit` cannot appear inside:
   - methods
   - helper functions
   - arrow functions
   - callbacks
   - if statements
   - loops
   - try/catch blocks
```

Valid:

```ts
class Customer inherits Identifiable, Timestamped {
    constructor(id: string, createdAt: Date) {
        inherit Identifiable(id) as private identifiable
        inherit Timestamped(createdAt) as private timestamped

        this.logCreated()
    }

    logCreated(): void {
        print("created")
    }
}
```

Invalid:

```ts
class Customer inherits Identifiable, Timestamped {
    constructor(id: string, createdAt: Date) {
        this.logCreated() // error: this used before inherit

        inherit Identifiable(id) as private identifiable
        inherit Timestamped(createdAt) as private timestamped
    }
}
```

Invalid:

```ts
class Customer inherits Identifiable {
    constructor(id: string) {
        this.init(id)
    }

    init(id: string): void {
        inherit Identifiable(id) as private identifiable // error
    }
}
```

---

## 6. Inheriting a Base With No Constructor

Even if an inherited class has no declared constructor, it must still be initialized.

```ts
class Taggable {
    tag: string = ""
}

class Customer inherits Taggable {
    constructor() {
        inherit Taggable() as private taggable
    }
}
```

Reason:

```txt
`inherit Base() as alias` does more than call a constructor.
It marks the base as initialized.
It creates the alias.
It establishes visibility and lifetime behavior.
```

Rule:

```txt
Every class listed in `inherits` must have exactly one matching `inherit Base(...) as alias`.
If the base has no constructor, call it as `inherit Base() as alias`.
```

---

## 7. Aliases for Inherited Bases

`inherit Base(...) as alias` initializes a base and creates an alias for that inherited part.

```ts
class Customer inherits Identifiable, Timestamped {
    constructor(id: string, createdAt: Date) {
        inherit Identifiable(id) as private identifiable
        inherit Timestamped(createdAt) as protected timestamped
    }
}
```

The alias is accessed through `this`.

```ts
this.identifiable.peek()
this.timestamped.peek()
```

The alias is not a static class call. It represents the inherited base subobject inside the current instance.

---

## 8. Alias Visibility

Aliases support visibility modifiers.

```ts
inherit Identifiable(id) as identifiable
inherit Identifiable(id) as public identifiable
inherit Identifiable(id) as protected identifiable
inherit Identifiable(id) as private identifiable
```

Recommended rule:

```txt
as alias
    Public by default.

as public alias
    Public instance alias.

as protected alias
    Accessible inside the class and subclasses.

as private alias
    Accessible only inside the class.
```

Example:

```ts
class Customer inherits Identifiable, Timestamped {
    constructor(id: string, createdAt: Date) {
        inherit Identifiable(id) as identifiable
        inherit Timestamped(createdAt) as private timestamped
    }
}

let customer: Customer = new Customer("u_1", Date.now())

customer.identifiable.peek() // valid because identifiable is public
customer.timestamped.peek()  // error because timestamped is private
```

---

## 9. Method Conflict Rules

If two inherited bases define the same visible method, Yogi must not choose automatically.

Invalid:

```ts
class A {
    peek(): string {
        return "A"
    }
}

class B {
    peek(): string {
        return "B"
    }
}

class C inherits A, B {
    constructor() {
        inherit A() as private a
        inherit B() as private b
    }
}
```

Error:

```txt
Conflict: method `peek()` is inherited from both `A` and `B`.
Class `C` must override `peek()`.
```

Valid:

```ts
class C inherits A, B {
    constructor() {
        inherit A() as private a
        inherit B() as private b
    }

    override peek(): string {
        return this.a.peek() + " " + this.b.peek()
    }
}
```

Rules:

```txt
1. If only one base has a method, it can be called normally through `this.method()`.
2. If multiple bases have the same method, the child must override.
3. The order of `inherits` does not decide which method wins.
4. No “first wins”.
5. No “last wins”.
6. The child class must resolve the conflict explicitly.
```

---

## 10. Direct Calls to Inherited Methods

If there is no conflict, inherited methods can be called directly through `this`.

```ts
class ConfigOwner {
    setConfigValue(value: number): void {
        // ...
    }
}

class Customer inherits ConfigOwner {
    constructor() {
        inherit ConfigOwner() as private configOwner
    }

    update(): void {
        this.setConfigValue(100)
    }
}
```

The alias is also allowed:

```ts
this.configOwner.setConfigValue(100)
```

Recommended interpretation:

```txt
this.setConfigValue(...)
    Calls the inherited method normally as part of Customer.

this.configOwner.setConfigValue(...)
    Calls the specific inherited base implementation through its alias.
```

With conflicts, use aliases inside the override:

```ts
class Customer inherits ConfigOwner, Timestamped {
    constructor() {
        inherit ConfigOwner() as private configOwner
        inherit Timestamped() as private timestamped
    }

    override update(): void {
        this.configOwner.update()
        this.timestamped.update()
    }
}
```

---

## 11. `abstract`

Yogi should keep TypeScript-like `abstract`.

```ts
abstract class Saveable {
    abstract save(): void
}
```

An abstract class can declare methods without implementation.

A concrete child must implement them.

```ts
class DatabaseRecord extends Saveable {
    override save(): void {
        print("saving database")
    }
}
```

Invalid:

```ts
class BrokenRecord extends Saveable {
}
```

Error:

```txt
Class `BrokenRecord` must implement abstract method `save`.
```

Rules:

```txt
1. Abstract classes cannot be instantiated directly.
2. Abstract methods must be implemented by concrete child classes.
3. Implementing an abstract method requires `override`.
```

---

## 12. `override`

`override` is required whenever a class replaces or implements an inherited method.

```ts
class User {
    name(): string {
        return "user"
    }
}

class Admin extends User {
    override name(): string {
        return "admin"
    }
}
```

Invalid:

```ts
class Admin extends User {
    name(): string {
        return "admin"
    }
}
```

Error:

```txt
Method `name` overrides an inherited method.
Use `override`.
```

Rules:

```txt
1. Implementing an abstract method requires `override`.
2. Replacing an inherited method requires `override`.
3. Resolving inherited method conflicts requires `override`.
4. Defining a method with the same signature as an inherited method without `override` is an error.
```

---

## 13. Polymorphism

Polymorphism means using different concrete classes through a common base type.

```ts
abstract class Saveable {
    abstract save(): void
}

class DatabaseRecord extends Saveable {
    override save(): void {
        print("database")
    }
}

class FileRecord extends Saveable {
    override save(): void {
        print("file")
    }
}

function persist(item: Saveable): void {
    item.save()
}
```

Usage:

```ts
persist(new DatabaseRecord())
persist(new FileRecord())
```

`Saveable` does not need to implement `save()` itself. It declares the requirement.

```txt
persist accepts any object that is Saveable.
Because Saveable requires save(), persist can call item.save().
The concrete runtime object decides which implementation is executed.
```

With `inherits`:

```ts
class UserRecord inherits DatabaseRecord, FileRecord {
    constructor() {
        inherit DatabaseRecord() as private database
        inherit FileRecord() as private file
    }

    override save(): void {
        this.database.save()
        this.file.save()
    }
}

persist(new UserRecord())
```

---

# Memory, Pointers, `.ref`, Escape Analysis and Lifetime

Yogi uses a stack-first, RAII-style memory model with escape analysis.

```txt
Default:
    Values live in the current scope.

If they do not escape:
    They can stay on the stack/local storage.

If they escape:
    Yogi promotes them to heap-managed storage.

When they die:
    Yogi automatically runs destructors/frees memory.
```

The developer should not manually call `free` or `delete`.

---

## 14. RAII-Style Lifetime

RAII means:

```txt
Resource Acquisition Is Initialization
```

In practice:

```txt
A value/resource is initialized when it is created.
It is automatically destroyed when its lifetime ends.
```

Yogi model:

```txt
stack-first
scope-based lifetime
automatic destruction
escape-aware heap promotion
no manual free
no traditional GC required
```

Example:

```ts
function demo(): void {
    let config: Config = new Config(10)

    // use config
}
```

If `config` does not escape:

```txt
config is destroyed at the end of demo().
```

---

## 15. `.ref`

Yogi should use `.ref` instead of C/C++ `&`.

Instead of:

```ts
new ConfigOwner(&config)
```

Yogi uses:

```ts
new ConfigOwner(config.ref)
```

Meaning:

```txt
config.ref creates an explicit reference to the original config object.
It does not copy config.
If the receiver modifies the pointer, it modifies the original object.
```

---

## 16. `pointer<T>`

`pointer<T>` represents an explicit mutable reference to a value of type `T`.

```ts
class Config {
    value: number

    constructor(value: number) {
        this.value = value
    }
}

class ConfigOwner {
    config: pointer<Config>

    constructor(config: pointer<Config>) {
        this.config = config
    }

    setConfigValue(value: number): void {
        this.config.value = value
    }
}
```

Usage:

```ts
let config: Config = new Config(10)

let owner: ConfigOwner = new ConfigOwner(config.ref)

owner.setConfigValue(200)

print(config.value) // 200
```

Rules:

```txt
1. `pointer<T>` does not copy T.
2. `pointer<T>` points to the original object.
3. Mutating through `pointer<T>` mutates the original object.
4. `pointer<T>` is non-owning by default.
5. `.ref` is explicit and tells the compiler the object may be referenced.
```

---

## 17. `.ref` Does Not Automatically Mean Heap

This is important:

```txt
.ref does not automatically mean heap.
.ref means the value is being referenced.
Escape analysis decides whether it must be promoted.
```

No escape:

```ts
function demo(): void {
    let config: Config = new Config(10)

    let owner: ConfigOwner = new ConfigOwner(config.ref)

    owner.setConfigValue(100)

    print(config.value)
}
```

Analysis:

```txt
config is local.
owner is local.
owner does not escape.
Therefore config can stay local/stack.
Destroy config at the end of demo().
```

Escape:

```ts
function createOwner(): ConfigOwner {
    let config: Config = new Config(10)

    return new ConfigOwner(config.ref)
}
```

Analysis:

```txt
config is local.
config.ref is stored in ConfigOwner.
ConfigOwner is returned.
Therefore config escapes.
Promote config to heap.
Destroy config when its lifetime anchor dies.
```

---

## 18. Owner vs Pointer Holder

Important distinction:

```txt
The pointer is not the owner.
The pointer only points.

The owner is the thing responsible for keeping the object alive.
```

Example:

```ts
function demo(): void {
    let config: Config = new Config(10)

    let owner: ConfigOwner = new ConfigOwner(config.ref)
}
```

Here:

```txt
owner of Config = local variable config
pointer holder = owner.config
```

`owner.config` does not free `config`.

---

## 19. Lifetime Anchor

When a local value is promoted because it escapes, Yogi needs a lifetime anchor.

A lifetime anchor is:

```txt
The object or storage that keeps a promoted object alive.
```

Example:

```ts
function createOwner(): ConfigOwner {
    let config: Config = new Config(10)

    return new ConfigOwner(config.ref)
}
```

Analysis:

```txt
config is created locally.
ConfigOwner stores config.ref.
ConfigOwner is returned.
config is promoted to heap.
The returned ConfigOwner becomes the lifetime anchor for config.
```

When the returned `ConfigOwner` dies:

```txt
config can be destroyed.
```

---

## 20. Multiple Lifetime Anchors

A value can be referenced by multiple escaping objects.

```ts
class Pair {
    a: ConfigOwner
    b: ConfigOwner

    constructor(a: ConfigOwner, b: ConfigOwner) {
        this.a = a
        this.b = b
    }
}

function createPair(): Pair {
    let config: Config = new Config(10)

    let a: ConfigOwner = new ConfigOwner(config.ref)
    let b: ConfigOwner = new ConfigOwner(config.ref)

    return new Pair(a, b)
}
```

Analysis:

```txt
config.ref is stored in a.
config.ref is stored in b.
a and b are stored inside Pair.
Pair is returned.
config must live as long as Pair.
```

Possible implementation:

```txt
Pair becomes the lifetime anchor group.
When Pair dies, a, b, and promoted config can be destroyed.
```

Alternative runtime model:

```txt
config has promoted metadata.
a and b both hold escaped references.
config is destroyed when the last escaped anchor dies.
```

---

## 21. Heap Promotion

Heap promotion occurs when a value cannot safely die at the end of its original scope.

### Return Escape

```ts
function createOwner(): ConfigOwner {
    let config: Config = new Config(10)
    return new ConfigOwner(config.ref)
}
```

Promote `config`.

### Global Escape

```ts
let globalOwner: ConfigOwner

function setup(): void {
    let config: Config = new Config(10)

    globalOwner = new ConfigOwner(config.ref)
}
```

Promote `config`.

Reason:

```txt
globalOwner can outlive setup().
config must outlive setup().
```

### Object Field Escape

```ts
function createCustomer(): Customer {
    let config: Config = new Config(10)

    let customer: Customer = new Customer(config.ref)

    return customer
}
```

Promote `config` because `customer` escapes and stores a path to `config`.

### Unknown/Extern Escape

```ts
extern native from "./native.o" {
    function storeConfig(config: pointer<Config>): void
}

function setup(): void {
    let config: Config = new Config(10)

    storeConfig(config.ref)
}
```

Conservative rule:

```txt
Passing pointer<T> to unknown/extern code marks the pointee as escaping.
```

---

## 22. When to Free a Promoted Value

Do not free a promoted value when the original scope ends.

Wrong:

```txt
config was local in createOwner()
createOwner() ends
free config immediately
```

This would create a dangling pointer.

Correct rule:

```txt
Free the promoted value when no live lifetime anchor can reach it anymore.
```

Example:

```ts
function createOwner(): ConfigOwner {
    let config: Config = new Config(10)

    return new ConfigOwner(config.ref)
}

function main(): void {
    let owner: ConfigOwner = createOwner()

    owner.setConfigValue(50)
}
```

Lifetime:

```txt
createOwner:
    config is promoted because owner escapes.

main:
    owner keeps config alive.

end of main:
    owner dies.
    promoted config dies.
```

Key rule:

```txt
Yogi does not free by pointer.
Yogi frees by lifetime ownership.
```

---

## 23. Pointer Death Does Not Free the Pointee

Never define this rule:

```txt
pointer dies -> free pointee
```

That is dangerous.

Example:

```ts
let config: Config = new Config(10)

let a: ConfigOwner = new ConfigOwner(config.ref)
let b: ConfigOwner = new ConfigOwner(config.ref)
```

If `a` dies and frees `config`, then `b` has a dangling pointer.

Correct rule:

```txt
pointer dies -> pointer stops existing
owner/lifetime anchor dies -> pointee may be destroyed
```

---

## 24. `pointer<T>` Should Be Non-Owning by Default

Recommended default:

```txt
pointer<T> is non-owning.
It points to an object but does not own it.
```

This avoids:

```txt
double-free
accidental ownership transfer
cycles keeping objects alive forever
```

Possible future syntax:

```ts
pointer<Config>              // mutable non-owning reference
readonly pointer<Config>     // read-only non-owning reference
owned pointer<Config>        // owning reference, advanced feature
weak pointer<Config>         // weak reference, useful for cycles
```

For v1, recommended:

```txt
Support:
    pointer<T>
    readonly pointer<T> if possible

Avoid initially:
    owned pointer<T>
    weak pointer<T>
```

Unless ownership tracking is already mature.

---

## 25. Readonly Pointers

A readonly pointer can read the original object but cannot mutate it.

```ts
class ConfigReader {
    config: readonly pointer<Config>

    constructor(config: readonly pointer<Config>) {
        this.config = config
    }

    read(): number {
        return this.config.value
    }

    update(): void {
        this.config.value = 100 // error
    }
}
```

Use this when the receiver does not need mutation.

Good practice:

```txt
Use readonly pointer<T> for readers.
Use pointer<T> only when mutation is required.
```

---

## 26. Multiple Mutable Pointers

This is valid but potentially dangerous:

```ts
let config: Config = new Config(10)

let a: ConfigOwner = new ConfigOwner(config.ref)
let b: ConfigOwner = new ConfigOwner(config.ref)

a.setConfigValue(100)
b.setConfigValue(200)
```

Result depends on call order.

In single-threaded code:

```txt
This is a logic risk.
```

In multi-threaded code:

```txt
This can become a data race.
```

Possible compiler/runtime warning:

```txt
Warning: multiple mutable pointers to `config` exist.
```

This should not necessarily be an error in v1, but it is worth tracking.

---

## 27. Cycles

Cycles are dangerous without a traditional garbage collector.

```ts
class Parent {
    child: pointer<Child>
}

class Child {
    parent: pointer<Parent>
}

let parent: Parent = new Parent()
let child: Child = new Child()

parent.child = child.ref
child.parent = parent.ref
```

If both references are treated as owning, this can create a cycle:

```txt
parent -> child
child -> parent
```

Recommended rule:

```txt
pointer<T> is non-owning by default.
```

Future feature:

```ts
weak pointer<Parent>
```

Recommended pattern:

```ts
class Parent {
    child: owned pointer<Child>
}

class Child {
    parent: weak pointer<Parent>
}
```

For v1:

```txt
Detect cycles if possible.
Warn when objects store mutual pointers.
Do not make pointer<T> owning by default.
```

---

## 28. Bad Practices to Detect or Warn About

### A. Storing `.ref` Globally

```ts
let globalOwner: ConfigOwner

function setup(): void {
    let config: Config = new Config(10)

    globalOwner = new ConfigOwner(config.ref)
}
```

Warning:

```txt
`config` is promoted to heap because its reference is stored globally.
```

---

### B. Passing `pointer<T>` to Unknown External Code

```ts
extern native from "./native.o" {
    function store(config: pointer<Config>): void
}
```

Warning or conservative behavior:

```txt
Pointer passed to extern function.
Assuming the pointer may escape.
Promoting pointee.
```

---

### C. Keeping Pointers Longer Than Needed

Bad:

```ts
class UserProfile {
    config: pointer<Config>

    constructor(config: pointer<Config>) {
        this.config = config
    }
}
```

If only a value is needed:

```ts
class UserProfile {
    value: number

    constructor(config: Config) {
        this.value = config.value
    }
}
```

Guideline:

```txt
Use pointer<T> only when the object must be observed or mutated after construction.
```

---

### D. Multiple Writers

```ts
let a: ConfigOwner = new ConfigOwner(config.ref)
let b: ConfigOwner = new ConfigOwner(config.ref)
```

Warning:

```txt
Multiple mutable references to `config`.
Mutation order may affect behavior.
```

---

### E. Escaping Reference to Short-Lived Local

```ts
function createOwner(): ConfigOwner {
    let config: Config = new Config(10)

    return new ConfigOwner(config.ref)
}
```

In Yogi this should be allowed through heap promotion, but compiler diagnostics should be able to explain it:

```txt
`config` promoted to heap because `config.ref` escapes through returned ConfigOwner.
```

---

## 29. Compiler To-Do List

The compiler should track these cases.

### Class and Inheritance

- [ ] Reserve `inherits`.
- [ ] Reserve `inherit`.
- [ ] Reserve `super`.
- [ ] Allow `extends` for single inheritance.
- [ ] Allow `inherits` for multiple inheritance.
- [ ] Reject `super` inside classes using `inherits`.
- [ ] Require `inherit Base(...) as alias` for every base in `inherits`.
- [ ] Require `inherit` statements at the beginning of constructors.
- [ ] Reject `inherit` outside constructors.
- [ ] Reject `inherit` inside nested functions, methods, loops, ifs, callbacks or try/catch.
- [ ] Enforce `inherit` order matching `inherits` order.
- [ ] Require alias for every inherited base initialization.
- [ ] Support alias visibility: public, protected, private.
- [ ] Default `as alias` to public.
- [ ] Make aliases accessible through `this.alias`.
- [ ] Allow direct inherited method calls through `this.method()` when no conflict exists.
- [ ] Detect inherited method conflicts.
- [ ] Require `override` to resolve conflicts.
- [ ] Require `override` when redefining any inherited method.
- [ ] Support abstract classes.
- [ ] Require concrete classes to implement abstract methods.

### Pointer and `.ref`

- [ ] Implement `.ref` expression.
- [ ] Implement `pointer<T>`.
- [ ] Treat `pointer<T>` as non-owning by default.
- [ ] Mutating through `pointer<T>` mutates the original object.
- [ ] Optionally implement `readonly pointer<T>`.
- [ ] Reject mutation through `readonly pointer<T>`.
- [ ] Track the source variable/object of every `.ref`.
- [ ] Track where each pointer is stored.
- [ ] Track when a pointer is returned.
- [ ] Track when a pointer is stored in a field.
- [ ] Track when a pointer is assigned to a global.
- [ ] Track when a pointer is passed to unknown or extern code.

### Escape Analysis

- [ ] Detect local object does not escape.
- [ ] Keep non-escaping objects local/stack when possible.
- [ ] Detect return escape.
- [ ] Detect global escape.
- [ ] Detect object-field escape.
- [ ] Detect closure/callback capture escape.
- [ ] Detect alias propagation escape.
- [ ] Detect extern/unknown function escape conservatively.
- [ ] Propagate escape through inherited bases.
- [ ] Propagate escape through objects containing pointers.
- [ ] Promote escaping values to heap.
- [ ] Create lifetime anchor for promoted values.
- [ ] Track multiple lifetime anchors.
- [ ] Free promoted values when no live lifetime anchor can reach them.
- [ ] Avoid freeing based on pointer death alone.
- [ ] Generate diagnostics explaining why a value was promoted.
- [ ] Generate debug telemetry for heap promotions and frees.

### Lifetime and Destruction

- [ ] Schedule destructor at end of scope for non-escaping objects.
- [ ] Schedule destructor/free for promoted heap objects when lifetime anchor dies.
- [ ] Support lifetime groups for promoted object graphs.
- [ ] Detect possible cycles.
- [ ] Warn about mutual pointers if needed.
- [ ] Warn about global lifetime extension.
- [ ] Warn about multiple mutable pointers if useful.
- [ ] Ensure no dangling pointer after scope exit.
- [ ] Ensure no double-free.
- [ ] Ensure destructor order is stable and predictable.

---

## 30. Core Design Rules Summary

```txt
Classes:
    extends = single inheritance
    inherits = multiple inheritance
    super = only for extends
    inherit = only for inherits constructors

Methods:
    override required for inherited replacement
    conflict requires override
    no automatic first-wins or last-wins

Aliases:
    inherit Base(...) as alias
    alias becomes this.alias
    as alias is public by default
    private/protected/public supported

Memory:
    values are stack-first
    .ref creates explicit reference
    pointer<T> stores reference, not copy
    pointer<T> is non-owning by default
    mutation through pointer mutates original
    .ref does not automatically mean heap
    escape analysis decides heap promotion

Lifetime:
    non-escaping values die at scope end
    escaping values are promoted
    promoted values live through lifetime anchors
    pointer death does not free pointee
    Yogi frees by lifetime ownership, not by pointer
```

---

## 31. Key Principle

```txt
Yogi should give the developer the power of explicit references and native memory behavior,
but the compiler and runtime should manage lifetime intelligently.

No manual free.
No traditional GC requirement.
Stack-first by default.
Heap only when escape analysis requires it.
```
