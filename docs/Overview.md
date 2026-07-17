# Yogi Overview

This file tracks the high-level shape of the language and the real programs
used to validate it.

Use the focused TODO files for feature-level details. Use this overview to see
which complete programs exist today and which programs are waiting for more
language support.

## Test Categories

| Category | Location | Purpose |
|---|---|---|
| Unit tests | `tests/runtime/unit/` and compiler Jest tests | Validate focused runtime/compiler behavior |
| Focused pipeline tests | `tests/runtime/sessions/` | Validate one language area or semantic rule end to end |
| Program Tests | `tests/programs/` | Validate complete Yogi programs that combine multiple features |

## Existing Program Tests

| Program | File | Status | Notes |
|---|---|---|---|
| Inventory Manager | `tests/programs/inventory_manager.cmake` | Implemented | Exercises structs, dynamic arrays, array callbacks, loops, mutation, functions, arithmetic, control flow, LLVM lowering, object generation, linking, and runtime execution |
| Tagged User Cleanup | `tests/programs/tagged_user_cleanup.cmake` | Implemented | Exercises `ptr<User[]>` parameters, pointer/value `for...of` iteration, string tags, struct mutation, `splice`, `.length` on pointer arrays, LLVM lowering, object generation, linking, and runtime execution |

## Planned Program Tests

These should be added only when the language naturally supports the features
they need.

| Program | Status | Waiting On |
|---|---|---|
| Contact Manager | Not implemented | More string/object ergonomics and richer object printing |
| Matrix Operations | Not implemented | More fixed-shape/native matrix lowering and numeric polish |
| Graph Traversal BFS | Not implemented | More nested dynamic-array ownership and queue-like collection behavior |
| Graph Traversal DFS | Not implemented | Same graph data-model support as BFS |
| Dijkstra | Not implemented | Priority queue or comparable collection support |
| Expression Evaluator | Not implemented | More parser-facing string/token utilities |
| CSV Processor | Not implemented | File/string splitting APIs |
| JSON Processor | Not implemented | Object runtime and parser utilities |
| Scheduler | Not implemented | Date/time or richer domain primitives |
| LRU Cache | Not implemented | Map/hash table data structure support |

## Current Language Shape

Yogi currently focuses on:

- strict explicit types
- stack-first ownership and RAII-style cleanup
- structs as real custom data types
- object-like interface/type contracts
- arrays, fixed-shape arrays, callbacks, and iterators
- pointer syntax and pointer provenance
- runtime memory checks
- LLVM lowering and executable generation

The language deliberately does not copy every TypeScript semantic behavior.
Yogi keeps TypeScript-like syntax where useful, but applies stricter compiler
and runtime rules.
