# Lot 60: Program Tests

This lot introduces Program Tests as a separate test category.

Program Tests are complete Yogi programs. They are not replacements for unit
tests or focused pipeline tests. Their job is to validate that many language
systems work together in realistic code.

## Added Program

### Inventory Manager

Test file:

```txt
tests/programs/inventory_manager.cmake
```

The program models a small inventory workflow:

- declare a `Product` struct
- search products by id
- sell stock
- restock inventory
- compute total inventory value
- count low-stock products with an array callback
- print and assert program output

Coverage:

- structs
- dynamic arrays
- arrays of structs
- field mutation
- functions
- `for`
- `for...of`
- callback methods
- arithmetic
- control flow
- LLVM IR generation
- object file generation
- executable generation
- runtime execution

## Documentation

Added:

```txt
docs/testing/program-tests.md
docs/Overview.md
```

Updated:

```txt
docs/testing/runtime-test-organization.md
```

## Rule

Future Program Tests must only use features that Yogi already supports. Planned
programs should stay documented as planned until the language naturally supports
their required syntax and runtime behavior.

