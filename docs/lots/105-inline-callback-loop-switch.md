# Lot 105: Inline Callback Loops and Switch

## Goal

Complete structured control flow inside immediate array callbacks by lowering
`while`, `for`, `switch`, `break`, and `continue` without losing callback-local
ownership or running cleanup for values that were never initialized.

The implementation is shared by every inline callback array method. It does not
introduce a second callback execution model.

## Control Frames

The inline callback lowerer keeps a stack of control frames:

```txt
loop frame:
  break -> loop end
  continue -> loop condition or increment

switch frame:
  break -> switch end
  continue -> nearest enclosing loop
```

This preserves JavaScript/TypeScript behavior for a switch nested inside a
loop. `break` exits the switch, while `continue` continues the loop.

## LLVM Shape

Loops and switches receive explicit blocks:

```txt
callback.while.condition
callback.while.body
callback.while.end

callback.for.condition
callback.for.body
callback.for.increment
callback.for.end

callback.switch.check
callback.switch.case
callback.switch.default
callback.switch.end
```

Switch cases retain normal fall-through. Case expressions are checked in
source order and string cases use the runtime string-equality operation.

## Managed Locals and Direct Case Entry

Switch cases share one lexical scope. That creates an important lifetime case:

```ts
switch (value) {
    case 1:
        let report: Report = createReport()

    case 2:
        break
}
```

Execution may enter `case 2` directly, so `report` has a cleanup obligation but
was not initialized on that path. Every managed callback local now has an
`i1` active flag beside its cleanup slot:

```txt
declaration executes -> active = true
cleanup checks active
cleanup executes      -> active = false
direct case entry     -> active remains false
```

This prevents invalid destruction on direct entry and duplicate destruction
after early exits.

## Cleanup Rules

```txt
normal loop iteration:
  clean iteration locals before the back edge

continue:
  clean locals created after the loop frame, then branch to condition/increment

break:
  clean locals created after the selected frame, then branch to its end

early return:
  materialize the callback result, clean every active callback owner, and
  branch to callback.return

for initializer:
  remains alive for condition, body, and increment; it is cleaned at for.end
```

## Deep Failure Prevented

A cleanup slot alone is not enough to prove that a managed value exists. A
switch may jump directly past its declaration and still reach a shared cleanup
point. Destroying the slot on that path can interpret stale stack memory as an
owner, causing invalid free or double-free.

The active flag makes initialization a runtime path fact while preserving the
compiler's static cleanup schedule.

## Validation

```txt
tests/runtime/sessions/02-variables-aggregates/array_inline_callbacks.cmake
tests/runtime/sessions/02-variables-aggregates/array_reduce_aggregate_ownership.cmake
tests/programs/inline_callback_loop_switch_report.cmake
tests/programs/manifests/inline_callback_loop_switch_report.json
```

The focused tests cover loop values, fall-through, nested switch/loop control
frames, managed locals, and direct case entry. The Program Test adds nested
managed structs, arrays, strings, type-literal fields, early returns, LLVM CFG
inspection, sanitizer execution, and strict `allowLive: []` observability.

## Remaining Boundary

Persistent callbacks still require a closure environment and capture-lifetime
model. This lot applies to immediate callbacks lowered within the array method
invocation.
