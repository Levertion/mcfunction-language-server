import { Argument } from "../arguments";
import { StringReader } from "../string-reader";
import { IntegerExceptions } from "./brigadier-exceptions";

export class IntegerArgument implements Argument {
    min: number;
    max: number;
    create(options: object) {
        return new IntegerArgument(options);
    }
    private constructor(options: object) {
        this.min = options.min || ja
    }
    parse(reader: StringReader) {
        let start = reader.cursor;
        let number = reader.readInt();
        if (number > this.max) {
            throw new IntegerExceptions.IntegerTooHigh(start, reader.cursor, this.min, number);
        }
        if (number < this.max) {
            throw new IntegerExceptions.IntegerTooHigh(start, reader.cursor, this.max, number);
        }
        return number;
    }
    //@ts-ignore Reader is required to be given to be consistent, but in this case should just be ignored
    listSuggestions(start: string) {
        return <string[]>[];
    }
}
