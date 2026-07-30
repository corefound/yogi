if(NOT DEFINED YOGI_EXECUTABLE OR YOGI_EXECUTABLE STREQUAL "")
	message(FATAL_ERROR "YOGI_EXECUTABLE is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}")

set(SOURCE "${TEST_WORK_DIR}/main.ts")
file(WRITE "${SOURCE}" [=[
struct Product {
    id: number
    name: string
    quantity: number
    price: number
    reorderPoint: number
}

function findProductIndex(products: ptr<Product[]>, id: number): number {
    for (let i: number = 0; i < products.length; i = i + 1) {
        if (products[i].id == id) {
            return i
        }
    }

    return -1
}

function sell(products: ptr<Product[]>, id: number, amount: number): boolean {
    let index: number = findProductIndex(products, id)

    if (index < 0) {
        return false
    }

    if (products[index].quantity < amount) {
        return false
    }

    products[index].quantity = products[index].quantity - amount
    return true
}

function restock(products: ptr<Product[]>, id: number, amount: number): boolean {
    let index: number = findProductIndex(products, id)

    if (index < 0) {
        return false
    }

    products[index].quantity = products[index].quantity + amount
    return true
}

function totalValue(products: ptr<Product[]>): number {
    let total: number = 0

    for (let product: Product of products) {
        total = total + product.quantity * product.price
    }

    return total
}

function lowStockCount(products: ptr<Product[]>): number {
    let low: Product[] = products.filter((product: Product): boolean => {
        return product.quantity <= product.reorderPoint
    })

    return low.length
}

function inventoryProgram(): number {
    let inventory: Product[] = [
        { id: 1, name: "Keyboard", quantity: 10, price: 45, reorderPoint: 4 },
        { id: 2, name: "Mouse", quantity: 25, price: 20, reorderPoint: 8 },
        { id: 3, name: "Cable", quantity: 5, price: 8, reorderPoint: 5 }
    ]

    sell(&inventory, 1, 2)
    sell(&inventory, 3, 4)
    restock(&inventory, 2, 5)
    inventory.push({ id: 4, name: "Monitor", quantity: 3, price: 150, reorderPoint: 2 })

    let value: number = totalValue(&inventory)
    let low: number = lowStockCount(&inventory)
    let keyboardIndex: number = findProductIndex(&inventory, 1)

    print(value)
    print(low)
    print(inventory[keyboardIndex].quantity)

    return value + low * 1000 + inventory[keyboardIndex].quantity
}

print(inventoryProgram())
]=])

execute_process(
	COMMAND "${YOGI_EXECUTABLE}" "${SOURCE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE compile_result
	OUTPUT_VARIABLE compile_stdout
	ERROR_VARIABLE compile_stderr
)

if(NOT compile_result EQUAL 0)
	message(FATAL_ERROR "inventory manager program compile failed:\nstdout:\n${compile_stdout}\nstderr:\n${compile_stderr}")
endif()

set(EXECUTABLE "${TEST_WORK_DIR}/packages/.cache/bin/main")
set(IR "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.ll")
set(OBJECT "${TEST_WORK_DIR}/packages/.cache/modules/main.ts/main.o")

foreach(path IN ITEMS "${EXECUTABLE}" "${IR}" "${OBJECT}")
	if(NOT EXISTS "${path}")
		message(FATAL_ERROR "expected inventory manager program artifact was not generated: ${path}")
	endif()
endforeach()

file(READ "${IR}" ir)
foreach(symbol
		yogi_array_get
		yogi_array_length
		yogi_array_push
		_yogi_fn_main.ts_sell
		_yogi_fn_main.ts_restock
		_yogi_fn_main.ts_totalValue)
	if(NOT ir MATCHES "${symbol}")
		message(FATAL_ERROR "expected inventory manager IR to contain ${symbol}")
	endif()
endforeach()

execute_process(
	COMMAND "${EXECUTABLE}"
	WORKING_DIRECTORY "${TEST_WORK_DIR}"
	RESULT_VARIABLE run_result
	OUTPUT_VARIABLE run_stdout
	ERROR_VARIABLE run_stderr
)

if(NOT run_result EQUAL 0)
	message(FATAL_ERROR "inventory manager executable failed:\nstdout:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()

set(expected_stdout "1418\n1\n8\n2426\n")
if(NOT run_stdout STREQUAL expected_stdout)
	message(FATAL_ERROR "inventory manager program printed unexpected output:\nexpected:\n${expected_stdout}\nactual:\n${run_stdout}\nstderr:\n${run_stderr}")
endif()
