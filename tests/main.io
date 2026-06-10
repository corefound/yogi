// const a: number = 10 + 10 - 10.5; // good
// let retries: number = 3; // good

// const b = 10 + 10 - 10.5; // bad - missing type annotation
// const c: string = 10 + 10 - 10.5; // bad - type mismatch
// const d: number = 10 + 10 - 10.5 + ''; // bad - type mismatch
// const port: number; // bad - must be initialized
// let retries: number; //  // bad - must be initialized

// const timeout: number = 1000; // good 
// const timeout: number = 2000; // bad - already defined

// good - shadowing in inner scope

// const value: number = 10;
// function test(): number { // good - shadowing in inner scope
//     const value: number = 20;
//     return value;
// }

// bad - use before declaration
// const total: number = price + 10;
// const price: number = 20;


// good - assignment to let
// let count: number = 0;
// count = count + 1;

// bad - assignment to const
// const count: number = 0;
// count = count + 1;

// bad - assignment type mismatch
// let name: string = "John";
// name = 10;

// bad - unknown identifier
// let total: number = price + 10;

// bad - invalid binary expression
// const active: boolean = true + false;

// good - boolean expression
// const age: number = 20;
// const isAdult: number = age >= 18;

// bad - boolean expected, number received
// const isAdult: boolean = 18;

// good - string concat if you allow string + string
// const fullName: string = "John" + " " + "Doe";


// bad - string + number forbidden
// const label: string = "Age: " + 30;

// good - comparison returns boolean
// const valid: boolean = 10 + 5 > 12;

// good - nested expression
const result: number = (10 + 20) * (30 - 5);