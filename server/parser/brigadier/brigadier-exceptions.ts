import { mcError } from "../exceptions";

export namespace IntegerExceptions {
    export class IntegerTooLow extends mcError {
        description = "Integer must not be less than %s, found %s";
        type = "argument.integer.low";
        constructor(start: number, end: number, expected: number, got: number) {
            super(start, end, expected.toString(), got.toString());
        };
    }
    export class IntegerTooHigh extends mcError {
        description = "Integer must not be more than %s, found %s";
        type = "argument.integer.big";
        constructor(start: number, end: number, expected: number, got: number) {
            super(start, end, expected.toString(), got.toString());
        };
    }
}
