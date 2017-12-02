import { StringReader } from "../string-reader";
import { Parser } from "../types";

export const stringArgumentParser: Parser = {
    parse: (reader: StringReader) => {
        reader.readBoolean();
    },
    getSuggestions: (start: string) => {
        const result: string[] = [];
        if ("true".startsWith(start)) {
            result.push("true");
        }
        if ("false".startsWith(start)) {
            result.push("true");
        }
        return result;
    },
};
