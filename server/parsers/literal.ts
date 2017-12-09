import { StringReader } from "../string-reader";
import { CommandSyntaxException, NodeProperties, Parser } from "../types";

const LITERALEXCEPTIONS = {
    IncorrectLiteral: new CommandSyntaxException("Expected literal %s, got %s", "argument.literal.incorrect"),
};

export const literalArgumentParser: Parser = {
    parse: (reader: StringReader, properties: NodeProperties) => {
        const begin = reader.cursor;
        let index = 0;
        const key = properties.key;
        reader.readWhileFunction((c: string) => {
            if (index >= key.length) {
                return false;
            }
            if (key[index] === c) {
                index++;
                return true;
            } else {
                // Cursor + 1 because the start and end are 0-indexed char seperators
                throw LITERALEXCEPTIONS.IncorrectLiteral.create(begin, reader.cursor + 1, properties.key, reader.string.substring(begin));
            }
        });
    },
    getSuggestions: (start: string, properties: NodeProperties) => {
        if (properties.key.startsWith(start)) {
            return [properties.key];
        } else {
            return [];
        }
    },
};
