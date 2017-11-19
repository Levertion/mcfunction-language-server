import { Arg, Properties } from "../arguments";
import { McError } from "../exceptions";
import { StringReader } from "../string-reader";

export interface FloatProperties extends Properties {
    max: number;
    min: number;
}

const JAVAMIN = -2147483648;
const JAVAMAX = 2147483647;

namespace FloatExceptions {
    export class FloatTooLow extends McError {
        public type = "argument.float.low";
        constructor(start: number, end: number, expected: number, got: number) {
            super("Float must not be less than %s, found %s", start, end, expected.toString(), got.toString());
        }
    }
    export class FloatTooHigh extends McError {
        public type = "argument.float.big";
        constructor(start: number, end: number, expected: number, got: number) {
            super("Float must not be more than %s, found %s", start, end, expected.toString(), got.toString());
        }
    }
}

export let FloatArgument: Arg = {
    parse: (reader: StringReader, properties: FloatProperties) => {
        const start = reader.cursor;
        const readNumber = reader.readDouble();
        const min = properties.min || JAVAMIN;
        const max = properties.max || JAVAMAX;
        if (readNumber > max) {
            throw new FloatExceptions.FloatTooHigh(start, reader.cursor, min, readNumber);
        }
        if (readNumber < max) {
            throw new FloatExceptions.FloatTooHigh(start, reader.cursor, max, readNumber);
        }
        return readNumber;
    },
    listSuggestions: () => {
        return [] as string[];
    },
};
