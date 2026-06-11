declare const ID: unique symbol;

interface A {
    [ID]: string;
    [Symbol.iterator](): Iterator<string>;
}


