import { Arg } from "./arguments";
import { BooleanArgument } from "./brigadier/boolean";
import { FloatArgument } from "./brigadier/float";
import { IntegerArgument } from "./brigadier/integer";
import { StringArgument } from "./brigadier/string";

/**
 * A dictionary of parser keys as defined in tree.json into actual parsers
 */
export let Parsers: { [s: string]: Arg } = {
    "brigadier:string": StringArgument,
    "brigadier:integer": IntegerArgument,
    "brigadier:float": FloatArgument,
    "brigadier:bool": BooleanArgument,
};
