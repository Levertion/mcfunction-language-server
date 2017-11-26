import { StringReader } from "../brigadier-implementations";
import { CommandSyntaxException, NodeProperties, Parser } from "../types";

const LITERALEXCEPTIONS = {
    IncorrectLiteral: new CommandSyntaxException("Expected literal %s, got %s", "argument.literal.incorrect"),
    MissingSpace: new CommandSyntaxException("Expected a space after literal, got %s", "argument.literal.missingspace"),
};

export const literalArgumentParser: Parser = {
    parse: (reader: StringReader, properties: NodeProperties) => {
        const begin = reader.cursor;
        for (const char of properties.key) {
            if (char === reader.peek()) {
                if (reader.canRead()) {
                    reader.skip();
                } else {
                    break;
                }
            } else {
                throw LITERALEXCEPTIONS.IncorrectLiteral.create(begin, reader, properties.key, reader.string.substring(begin, reader.cursor));
            }
        }
        if (reader.peek() !== " " || !reader.canRead()) {
            throw LITERALEXCEPTIONS.MissingSpace.create(reader.cursor, reader, reader.string.substring(reader.cursor));
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
