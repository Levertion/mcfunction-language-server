import { CompletionItemKind } from "vscode-languageserver/lib/main";
import { BASECOLORS } from "../../consts";
import { StringReader } from "../../string-reader";
import { CommandSyntaxException, Parser } from "../../types";

const EXCEPTIONS = {
    Unknown: new CommandSyntaxException("Unknown display slot '%s'", "argument.slot.unknown"),
};

const slots = [
    "belowName", "list", "sidebar",
];
const TEAMBEGIN = "sidebar.team.";
const GETAVAILABLE = () => [...slots, ...BASECOLORS.map((c) => TEAMBEGIN + c)];
export const parser: Parser = {
    getSuggestions: (start: string) => {
        return GETAVAILABLE().filter((v) => v.startsWith(start));
    },
    parse: (reader: StringReader) => {
        const begin = reader.cursor;
        const read = reader.readUnquotedString();
        if (!GETAVAILABLE().includes(read)) {
            throw EXCEPTIONS.Unknown.create(begin, reader.cursor, read);
        }
    },
    kind: CompletionItemKind.Enum,
};
