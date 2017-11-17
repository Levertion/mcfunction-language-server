import { Argument } from "../arguments";
import { StringReader } from "../string-reader";

export class BooleanArgument extends Argument {
    public static parse(reader: StringReader) {
        reader.readBoolean();
    }
    public static listSuggestions(start: string) {
        const results: string[] = [];
        if ("true".startsWith(start)) {
            results.push("true");
        }
        if ("false".startsWith(start)) {
            results.push("false");
        }
        return results;
    }
}
