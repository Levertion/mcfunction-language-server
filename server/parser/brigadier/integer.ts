import { Arg, Properties } from "../arguments";
import { McError } from "../exceptions";
import { StringReader } from "../string-reader";

interface IntegerProperties extends Properties {
    max: number;
    min: number;
}

const JAVAMIN = -2147483648;
const JAVAMAX = 2147483647;

namespace IntegerExceptions {
    export class IntegerTooLow extends McError {
        public type = "argument.integer.low";
        constructor(start: number, end: number, expected: number, got: number) {
            super("Integer must not be less than %s, found %s", start, end, expected.toString(), got.toString());
        }
    }
    export class IntegerTooHigh extends McError {
        public type = "argument.integer.big";
        constructor(start: number, end: number, expected: number, got: number) {
            super("Integer must not be more than %s, found %s", start, end, expected.toString(), got.toString());
        }
    }
}

export let IntegerArgument: Arg = {
    parse: (reader: StringReader, properties: IntegerProperties) => {
        const start = reader.cursor;
        const readNumber = reader.readInt();
        const min = properties.min || JAVAMIN;
        const max = properties.max || JAVAMAX;
        if (readNumber > max) {
            throw new IntegerExceptions.IntegerTooHigh(start, reader.cursor, min, readNumber);
        }
        if (readNumber < max) {
            throw new IntegerExceptions.IntegerTooLow(start, reader.cursor, max, readNumber);
        }
        return readNumber;
    },
    listSuggestions: () => {
        return [] as string[];
    },
};
