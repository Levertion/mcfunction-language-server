import { StringReader } from "../../string-reader";
import { Parser } from "../../types";

// This parser is only used in commands which cannot be run in functions.
export const gameProfileArgumentParser: Parser = {
    parse: (reader: StringReader) => {
        reader.readString();
    },
    getSuggestions: () => {
        return ["This command is invalid in a function"];
    },
};
