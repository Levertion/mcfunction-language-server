import { Arg } from "../arguments";
import { StringReader } from "../string-reader";

export let BooleanArgument: Arg = {
    parse: (reader: StringReader) => {
        reader.readBoolean();
    },
    listSuggestions: (start: string) => {
        const results: string[] = [];
        if ("true".startsWith(start)) {
            results.push("true");
        }
        if ("false".startsWith(start)) {
            results.push("false");
        }
        return results;
    },
};
