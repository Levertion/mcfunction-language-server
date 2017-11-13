import { Argument } from "./arguments";
import { StringReader } from "../string-reader";
import { LiteralExceptions } from "./argument-exceptions";

export class LiteralArgument implements Argument {
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
    listSuggestions(reader: StringReader) {
        return [this.literal];
    }
}
