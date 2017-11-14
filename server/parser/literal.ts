import { StringReader } from "./string-reader";
import { LiteralExceptions } from "./literal-exceptions";

export class LiteralArgument {
    private literal: string;
    parse(reader: StringReader) {
        let start = reader.cursor;
        for (let index = 0; index < this.literal.length; index++) {
            if (reader.canRead() && this.literal.charAt(index) == reader.peek()) {
                reader.skip();
            }
            else {
                reader.cursor = start;
                throw new LiteralExceptions.IncorrectLiteral(start, this.literal, reader.string.substring(start, reader.cursor));
            }
        }
    }
    constructor(value: string) {
        this.literal = value;
    }
    //@ts-ignore Reader is required to be given to be consistent, but in this case should just be ignored
    listSuggestions(start: string) {
        if (this.literal.startsWith(start)) {
            return [this.literal];
        }
        else {
            return [];
        }
    }
}
