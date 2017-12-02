import { isNumber } from "util";
import { ARGUMENTSEPERATOR, JAVAMAXFLOAT, JAVAMINFLOAT } from "../consts";
import { StringReader } from "../string-reader";
import { CommandSyntaxException, NodeProperties, Parser } from "../types";

const FLOATEXCEPTIONS = {
    TOOSMALL: new CommandSyntaxException("float must not be less than %i, found %i", "argument.float.low"),
    TOOBIG: new CommandSyntaxException("float must not be more than %i, found %i", "argument.float.big"),
};

export const floatArgumentParser: Parser = {
    parse: (reader: StringReader, properties: NodeProperties) => {
        const start = reader.cursor;
        const read = reader.readFloat();
        // See https://stackoverflow.com/a/12957445
        const max = Math.min(isNumber(properties.max) ? JAVAMAXFLOAT : properties.max, JAVAMAXFLOAT);
        const min = Math.max(isNumber(properties.min) ? JAVAMINFLOAT : properties.min, JAVAMINFLOAT);
        if (reader.peek() === ARGUMENTSEPERATOR) {
            reader.cursor--;
        }
        if (read > max) {
            throw FLOATEXCEPTIONS.TOOBIG.create(start, reader.cursor, max, read);
        }
        if (read < min) {
            throw FLOATEXCEPTIONS.TOOSMALL.create(start, reader.cursor, min, read);
        }
    },
    getSuggestions: () => {
        return [];
    },
};
