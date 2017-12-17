import { StringReader } from "../../string-reader";
import { CommandSyntaxException, Parser } from "../../types";

const swizzleExceptions = {
    InvalidSwizzle: new CommandSyntaxException("Invalid swizzle, expected combination of 'x' 'y' and 'z'", "arguments.swizzle.invalid"),
};

export const swizzleArgumentParser: Parser = {
    parse: (reader: StringReader) => {
        const start = reader.cursor;
        const swizzlearr: string[] = [];
        while (reader.canRead() && reader.peek() !== " ") {
            const c: string = reader.read();
            if (c.match(/[x-z]/)) {
                if (swizzlearr.includes(c)) {
                    throw swizzleExceptions.InvalidSwizzle.create(start, reader.cursor);
                }
                swizzlearr.push(c);
            } else {
                throw swizzleExceptions.InvalidSwizzle.create(start, reader.cursor);
            }
        }
    },

    getSuggestions: (start: string) => {
        const suggest: string[] = ["x", "y", "z", "xy", "xz", "yx", "yz", "zx", "zy", "xyz", "xzy", "yxz", "yzx", "zxy", "zyx"];
        const out: string[] = [];
        for (const s of suggest) {
            if (s.startsWith(start)) {
                out.push(s);
            }
        }
        return out;
    },
};
