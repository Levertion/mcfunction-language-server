import { AXES } from "../../consts";
import { StringReader } from "../../string-reader";
import { CommandSyntaxException, Parser } from "../../types";

const EXCEPTIONS = {
    REPEATEDCHAR: new CommandSyntaxException("Expected up to one of %s, got %s more than once.", "argument.swizzle.repeat"),
    UNEXPECTEDCHAR: new CommandSyntaxException("Expected one of %s, got %s", "argument.swizzle.unexpected"),
};

export const swizzleArgumentParser: Parser = {
    parse: (reader: StringReader) => {
        const begin = reader.cursor;
        const toTest = reader.readUnquotedString();
        const axis: boolean[] = Array(AXES.length).fill(false);
        for (const char of toTest) {
            const index = AXES.indexOf(char);
            if (index !== -1) {
                if (!axis[index]) {
                    axis[index] = true;
                } else {
                    throw EXCEPTIONS.REPEATEDCHAR.create(begin, reader.cursor, AXES.join(), char);
                }
            } else {
                throw EXCEPTIONS.UNEXPECTEDCHAR.create(begin, reader.cursor, AXES.join, char);
            }
        }
    },
    getSuggestions: (start: string) => {
        const axes = AXES.slice();
        for (let i = 0; i < axes.length; i++) {
            const axis = axes[i];
            if (start.indexOf(axis) !== -1) {
                delete axes[i];
            }
        }
        return axes;
    },
};
