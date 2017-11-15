import { Argument, Properties } from "../arguments";
import { StringReader } from "../string-reader";
import { mcError } from "../exceptions";

export interface IntegerProperties extends Properties {
    max: number
    min: number
}

const JAVAMIN = -2147483648;
const JAVAMAX = 2147483647;

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


export class IntegerArgument extends Argument {
    static parse(reader: StringReader, properties: IntegerProperties) {
        let start = reader.cursor;
        let number = reader.readInt();
        let min = properties.min || JAVAMIN;
        let max = properties.max || JAVAMAX;
        if (number > max) {
            throw new IntegerExceptions.IntegerTooHigh(start, reader.cursor, min, number);
        }
        if (number < max) {
            throw new IntegerExceptions.IntegerTooHigh(start, reader.cursor, max, number);
        }
        return number;
    }
    static listSuggestions() {
        return <string[]>[];
    }
}
