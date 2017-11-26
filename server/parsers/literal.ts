import { StringReader } from "../brigadier-implementations";
import { CommandSyntaxException, NodeProperties, Parser } from "../types";

const LITERALEXCEPTIONS = {
    IncorrectLiteral: new CommandSyntaxException("Expected literal %s, got %s", "argument.literal.incorrect"),
};

export const literalArgumentParser: Parser = {
    parse: (reader: StringReader, properties: NodeProperties) => {
        const begin = reader.cursor;
        for (const iterator of properties.key) {
            if (reader.canRead() && iterator === reader.peek()) {
                reader.skip();
            } else {
                throw LITERALEXCEPTIONS.IncorrectLiteral.create(begin, reader, properties.key, reader.string.substring(begin, reader.cursor));
            }
        }
        // Test for a space
        if (reader.canRead()) {
            if (reader.peek() === " ") {
                reader.skip();
            } else {
                throw LITERALEXCEPTIONS.IncorrectLiteral.create(begin, reader, properties.key, reader.string.substring(begin, reader.cursor));
            }
        }
    },
    getSuggestions: (start: string, properties: NodeProperties) => {
        if (properties.key.startsWith(start)) {
            return [properties.key];
        } else {
            return [];
        }
    },
};
