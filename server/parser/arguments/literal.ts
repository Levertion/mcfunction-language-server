import { Argument } from "./arguments";
import { StringReader } from "../string-reader";
import { LiteralExceptions } from "./argument-exceptions";

export class literalArgument implements Argument {
    private literal: string;
    parse(reader: StringReader) {
        let start = reader.cursor;
        for (let index = 0; index < this.literal.length; index++) {
            if (reader.canRead() && this.literal.charAt(index) == reader.peek()) {
                reader.skip();
            }
            else {
                throw new LiteralExceptions.IncorrectLiteral(start, this.literal, reader.string.substring(start, reader.cursor));
            }
        }
    }
    constructor(value: string) {
        this.literal = value;
    }
}
