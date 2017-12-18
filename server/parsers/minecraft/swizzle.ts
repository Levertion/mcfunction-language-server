import { power } from "js-combinatorics";
import { CompletionItemKind } from "vscode-languageserver/lib/main";
import { StringReader } from "../../string-reader";
import { CommandSyntaxException, Parser } from "../../types";

const swizzleExceptions = {
    InvalidSwizzle: new CommandSyntaxException("Swizzle contains unexpected character %s, expected '%s'", "arguments.swizzle.invalid"),
    RepeatedChar: new CommandSyntaxException("Swizzle '%s' repeats the character %s", "argument.swizzle.repeat"),
};

const axes = ["x", "y", "z"];
export const parser: Parser = {
    parse: (reader: StringReader) => {
        const start = reader.cursor;
        const swizzlearr: string[] = [];
        while (reader.canRead() && reader.peek() !== " ") {
            const c: string = reader.read();
            if (axes.includes(c)) {
                if (swizzlearr.includes(c)) {
                    throw swizzleExceptions.RepeatedChar.create(start, reader.cursor, swizzlearr.join(), c);
                }
                swizzlearr.push(c);
            } else {
                throw swizzleExceptions.InvalidSwizzle.create(start, reader.cursor, c, axes.join(", "));
            }
        }
    },

    getSuggestions: (start: string) => {
        const found: string[] = [];
        for (const char of start) {
            if (axes.includes(char)) {
                found.push(char);
            } else {
                return [];
            }
        }
        const toUse = axes.filter((v) => !found.includes(v));
        return power(toUse).map<string>((v) => {
            const temp = [start];
            temp.push(...v);
            return temp.join("");
        });
    },
    kind: CompletionItemKind.Variable,
};
