import { StringReader } from "../../string-reader";
import { Parser } from "../../types";

export const parser: Parser = {
    parse: (reader: StringReader) => {
        reader.readBoolean();
    },
    getSuggestions: (start) => {
        const result: string[] = [];
        if ("true".startsWith(start)) {
            result.push("true");
        }
        if ("false".startsWith(start)) {
            result.push("false");
        }
        return result;
    },
};
