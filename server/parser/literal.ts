import { StringReader } from "./string-reader";
import { Properties, Argument } from "./arguments";
import { mcError } from "./exceptions";

export namespace LiteralExceptions {
    export class IncorrectLiteral extends mcError {
        description = "Expected literal %s, got %s";
        type = "argument.literal.incorrect";
        constructor(start: number, expected: string, got: string) {
            super(start, null, expected, got);
        }
    }
}


export class LiteralArgument extends Argument {
    static parse(reader: StringReader, properties: Properties) {
        let start = reader.cursor;
        for (let index = 0; index < properties.key.length; index++) {
            if (reader.canRead() && properties.key.charAt(index) == reader.peek()) {
                reader.skip();
            }
            else {
                reader.cursor = start;
                throw new LiteralExceptions.IncorrectLiteral(start, properties.key, reader.string.substring(start, reader.cursor));
            }
        }
    }
    static listSuggestions(start: string, properties: Properties) {
        if (properties.key.startsWith(start)) {
            return [properties.key];
        }
        else {
            return [];
        }
    }
}
