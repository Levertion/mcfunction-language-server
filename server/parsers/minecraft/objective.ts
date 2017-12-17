import { StringReader } from "../../string-reader";
import { CommandSyntaxException, Parser } from "../../types";

const objectiveExceptions = {
    TooLong: new CommandSyntaxException("Objective '%s' is longer than 16 characters", "arguments.objective.toolong"),
};

export const objectiveArgumentParser: Parser = {
    parse: (reader: StringReader) => {
        const start: number = reader.cursor;
        const obj: string = reader.readUnquotedString();
        if (obj.length > 16) {
            throw objectiveExceptions.TooLong.create(start, reader.cursor, obj);
        }
    },

    getSuggestions: (start: string) => {
        return [start];
    },
};
