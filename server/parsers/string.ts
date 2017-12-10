import { StringReader } from "../string-reader";
import { NodeProperties, Parser } from "../types";

export const stringArgumentParser: Parser = {
    parse: (reader: StringReader, properties: NodeProperties) => {
        switch (properties.type) {
            case "greedy":
                reader.readRemaining();
            case "word":
                reader.readUnquotedString();
                break;
            default:
                reader.readString();
                break;
        }
    },
    getSuggestions: () => {
        return [];
    },
};
