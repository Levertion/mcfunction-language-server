import { Argument, Properties } from "../arguments";
import { StringReader } from "../string-reader";
import { mcError } from "../exceptions";

export interface FloatProperties extends Properties {
    max: number
    min: number
}

const JAVAMIN = -2147483648;
const JAVAMAX = 2147483647;

export namespace FloatExceptions {
    export class FloatTooLow extends mcError {
        description = "Float must not be less than %s, found %s";
        type = "argument.float.low";
        constructor(start: number, end: number, expected: number, got: number) {
            super(start, end, expected.toString(), got.toString());
        };
    }
    export class FloatTooHigh extends mcError {
        description = "Float must not be more than %s, found %s";
        type = "argument.float.big";
        constructor(start: number, end: number, expected: number, got: number) {
            super(start, end, expected.toString(), got.toString());
        };
    }
}


export class FloatArgument extends Argument {
    static parse(reader: StringReader, properties: FloatProperties) {
        let start = reader.cursor;
        let number = reader.readDouble();
        let min = properties.min || JAVAMIN;
        let max = properties.max || JAVAMAX;
        if (number > max) {
            throw new FloatExceptions.FloatTooHigh(start, reader.cursor, min, number);
        }
        if (number < max) {
            throw new FloatExceptions.FloatTooHigh(start, reader.cursor, max, number);
        }
        return number;
    }
    static listSuggestions() {
        return <string[]>[];
    }
}
