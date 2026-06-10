
// bad - block scoped variable not visible outside block: 
export function test(): number { // TODO
    if (true) {
        const x: number = 10;
    }

    return x;
}