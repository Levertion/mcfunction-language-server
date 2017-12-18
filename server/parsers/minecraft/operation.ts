import { StringReader } from "../../string-reader";
import { CommandSyntaxException, Parser } from "../../types";

const operationExceptions = {
    Invalid: new CommandSyntaxException("Invalid operation", "arguments.operation.invalid"),
};

const operations = ["=", "+=", "-=", "*=", "/=", "%=", "<", ">", "><"];

export const operationArgumentParser: Parser = {
    parse: (reader: StringReader) => {
        const start = reader.cursor;
        const op = reader.readUntilRegexp(/ /);
        if (!operations.includes(op)) {
            throw operationExceptions.Invalid.create(start, reader.cursor);
        }
    },

    getSuggestions: (start: string) => {
        const out: string[] = [];
        for (const s of operations) {
            if (s.startsWith(start)) {
                out.push(s);
            }
        }
        return out;
    },
};
