import { StringReader } from "../brigadier-implementations";
import { CommandSyntaxException, NodeProperties, Parser } from "../types";

const LITERALEXCEPTIONS = {
    IncorrectLiteral: new CommandSyntaxException("Expected literal %s, got %s", "argument.literal.incorrect"),
    MissingSpace: new CommandSyntaxException("Expected a space after literal, got %s", "argument.literal.missingspace"),
};

export const literalArgumentParser: Parser = {
    parse: (reader: StringReader, properties: NodeProperties) => {
        const begin = reader.cursor;
        for (let i = 0; i < properties.key.length; i++) {
            const char = properties.key[i];
            if (reader.peek() === char) {
                if (i === properties.key.length - 1) {
                    break;
                }
                if (reader.canRead()) {
                    reader.skip();
                    continue;
                }
            }
            // Otherwise, throw an error
            throw LITERALEXCEPTIONS.IncorrectLiteral.create(begin, reader.cursor + 1, properties.key, reader.string.substring(begin, reader.cursor));
        }
        if (reader.canRead() && reader.peek(1) !== " ") {
            throw LITERALEXCEPTIONS.MissingSpace.create(reader.cursor + 1, reader, reader.string.substring(reader.cursor + 1));
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
