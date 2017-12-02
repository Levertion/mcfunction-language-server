import { ARGUMENTSEPERATOR, JAVAMAXINT, JAVAMININT } from "../consts";
import { StringReader } from "../string-reader";
import { CommandSyntaxException, NodeProperties, Parser } from "../types";

const INTEGEREXCEPTIONS = {
    TOOSMALL: new CommandSyntaxException("Integer must not be less than %i, found %i", "argument.integer.low"),
    TOOBIG: new CommandSyntaxException("Integer must not be more than %i, found %i", "argument.integer.big"),
};

export const integerArgumentParser: Parser = {
    parse: (reader: StringReader, properties: NodeProperties) => {
        const start = reader.cursor;
        const read = reader.readInt();
        // See https://stackoverflow.com/a/12957445
        const max = Math.min(isNaN(properties.max) ? JAVAMAXINT : properties.max, JAVAMAXINT);
        const min = Math.max(isNaN(properties.min) ? JAVAMININT : properties.min, JAVAMININT);
        if (reader.peek() === ARGUMENTSEPERATOR) {
            reader.cursor--;
        }
        if (read > max) {
            throw INTEGEREXCEPTIONS.TOOBIG.create(start, reader.cursor, max, read);
        }
        if (read < min) {
            throw INTEGEREXCEPTIONS.TOOSMALL.create(start, reader.cursor, min, read);
        }
    },
    getSuggestions: () => {
        return [];
    },
};
