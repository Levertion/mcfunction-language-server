import { COLORS } from "../../consts";
import { StringReader } from "../../string-reader";
import { CommandSyntaxException, Parser } from "../../types";

const EXCEPTIONS = {
    INVALIDCOLOUR: new CommandSyntaxException("Unknow color '%s'", "argument.color.unknown"),
};

export const colorArgumentType: Parser = {
    parse: (reader: StringReader) => {
        const begin = reader.cursor;
        let successful = false;
        const read = reader.readUnquotedString();
        for (const colour of COLORS) {
            if (colour === read) {
                successful = true;
            }
        }
        if (!successful) {
            throw EXCEPTIONS.INVALIDCOLOUR.create(begin, reader.cursor, read);

        }
    },
    getSuggestions: (start: string) => {
        const suggestions: string[] = [];
        for (const colour of COLORS) {
            if (colour.startsWith(start)) {
                suggestions.push(colour);
            }
        }
        return suggestions;
    },
};
