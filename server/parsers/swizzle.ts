import { StringReader } from "../string-reader";
import { CommandSyntaxException, Parser } from "../types";

enum SwizzleValue {
    X, Y, Z,
}

const swizzleExceptions = {
    InvalidSwizzle: new CommandSyntaxException("Invalid swizzle, expected combination of 'x' 'y' and 'z'", "arguments.swizzle.invalid"),
};

export const swizzleArgumentParser: Parser = {
    parse: (reader: StringReader) => {
        const start = reader.cursor;
        const swizzlearr: SwizzleValue[] = [];
        while (reader.canRead(0) && reader.peek() !== " ") {
            const c: string = reader.read();
            let val: SwizzleValue;
            switch (c) {
                case "x":
                    val = SwizzleValue.X;
                    break;
                case "y":
                    val = SwizzleValue.Y;
                    break;
                case "z":
                    val = SwizzleValue.Z;
                    break;
                default:
                    throw swizzleExceptions.InvalidSwizzle.create(start, reader.exceptionCursor());
            }
            if (swizzlearr.includes(val)) {
                throw swizzleExceptions.InvalidSwizzle.create(start, reader.exceptionCursor());
            }
            swizzlearr.push(val);
        }
    },

    getSuggestions: () => {
        return [];
    },
};
