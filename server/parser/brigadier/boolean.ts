import { Argument } from "../arguments";
import { StringReader } from "../string-reader";

export class BooleanArgument extends Argument {
    static parse(reader: StringReader) {
        reader.readBoolean();
    }
    static listSuggestions(start: string) {
        let results: string[] = [];
        if ("true".startsWith(start)) {
            results.push("true");
        }
        if ("false".startsWith(start)) {
            results.push("false");
        }
        return results;
    }
}
