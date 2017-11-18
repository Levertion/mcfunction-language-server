import { Arg, Properties } from "./arguments";
import { McError } from "./exceptions";
import { StringReader } from "./string-reader";

export namespace LiteralExceptions {
    export class IncorrectLiteral extends McError {
        public description = "Expected literal %s, got %s";
        public type = "argument.literal.incorrect";
        constructor(start: number, expected: string, got: string) {
            super(start, null, expected, got);
        }
    }
}

export const LiteralArgument: Arg = {
    parse: (reader: StringReader, properties: Properties) => {
        const start = reader.cursor;
        for (let index = 0; index < properties.key.length; index++) {
            if (reader.canRead() && properties.key.charAt(index) === reader.peek()) {
                reader.skip();
            } else {
                reader.cursor = start;
                throw new LiteralExceptions.IncorrectLiteral(start, properties.key, reader.string.substring(start, reader.cursor));
            }
        }
    },
    listSuggestions: (start: string, properties: Properties) => {
        if (properties.key.startsWith(start)) {
            return [properties.key];
        } else {
            return [];
        }
    },
};
