import { isNumber } from "util";
import { JAVAMAXFLOAT, JAVAMINFLOAT } from "../consts";
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
        const max = Math.min(isNumber(properties.max) ? properties.max : JAVAMAXFLOAT, JAVAMAXFLOAT);
        const min = Math.max(isNumber(properties.min) ? properties.min : JAVAMINFLOAT, JAVAMINFLOAT);
        if (read > max) {
            throw FLOATEXCEPTIONS.TOOBIG.create(start, reader.exceptionCursor(), max, read);
        }
        if (read < min) {
            throw FLOATEXCEPTIONS.TOOSMALL.create(start, reader.exceptionCursor(), min, read);
        }
    },
    getSuggestions: () => {
        return [];
    },
};
