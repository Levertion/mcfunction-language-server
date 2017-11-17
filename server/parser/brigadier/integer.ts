import { Argument, Properties } from "../arguments";
import { McError } from "../exceptions";
import { StringReader } from "../string-reader";

export interface IntegerProperties extends Properties {
    max: number;
    min: number;
}

const JAVAMIN = -2147483648;
const JAVAMAX = 2147483647;

export namespace IntegerExceptions {
    export class IntegerTooLow extends McError {
        public description = "Integer must not be less than %s, found %s";
        public type = "argument.integer.low";
        constructor(start: number, end: number, expected: number, got: number) {
            super(start, end, expected.toString(), got.toString());
        }
    }
    export class IntegerTooHigh extends McError {
        public description = "Integer must not be more than %s, found %s";
        public type = "argument.integer.big";
        constructor(start: number, end: number, expected: number, got: number) {
            super(start, end, expected.toString(), got.toString());
        }
    }
}

export class IntegerArgument extends Argument {
    public static parse(reader: StringReader, properties: IntegerProperties) {
        const start = reader.cursor;
        const readNumber = reader.readInt();
        const min = properties.min || JAVAMIN;
        const max = properties.max || JAVAMAX;
        if (readNumber > max) {
            throw new IntegerExceptions.IntegerTooHigh(start, reader.cursor, min, readNumber);
        }
        if (readNumber < max) {
            throw new IntegerExceptions.IntegerTooHigh(start, reader.cursor, max, readNumber);
        }
        return readNumber;
    }
    public static listSuggestions() {
        return [] as string[];
    }
}
