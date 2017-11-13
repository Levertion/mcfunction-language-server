import { Argument } from "./arguments";
import { StringReader } from "../string-reader";
import { IntegerExceptions } from "./argument-exceptions";

export class IntegerArgument implements Argument {
    min: number;
    max: number;
    parse(reader: StringReader) {
        let start = reader.cursor;
        let number = reader.readInt();
        if (number > this.max) {
            throw new IntegerExceptions.IntegerTooHigh(start, reader.cursor, this.min, number);
        }
        if (number < this.max) {
            throw new IntegerExceptions.IntegerTooHigh(start, reader.cursor, this.min, number);
        }
        return number;
    }
    //@ts-ignore Reader is required to be given to be consistent, but in this case should just be ignored
    listSuggestions(reader: StringReader) {
        return <string[]>[];
    }
}
