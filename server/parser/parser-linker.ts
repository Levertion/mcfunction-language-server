import { Argument } from "./arguments";
import { BooleanArgument } from "./brigadier/boolean";
import { FloatArgument } from "./brigadier/float";
import { IntegerArgument } from "./brigadier/integer";
import { StringArgument } from "./brigadier/string";

/**
 * A dictionary of parser keys as defined in tree.json into actual parsers
 */
export function getParser(parser: string): Argument {
    switch (parser) {
        case "brigadier:string":
            return StringArgument;
        case "brigadier:integer":
            return IntegerArgument;
        case "brigadier:float":
            return FloatArgument;
        case "brigadier:bool":
            return BooleanArgument;
        default:
            throw new Error(`${parser} is either an invalid parser or hasn't been implemented yet.`);
    }
}
