import { CommandNode, Parser } from "../types";

const defaultParsers: { [id: string]: string } = {
    "brigadier:integer": "./brigadier/integer",
    "brigadier:float": "./brigadier/float",
    "brigadier:bool": "./brigadier/bool",
    "brigadier:string": "./brigadier/string",
    "minecraft:swizzle": "./minecraft/swizzle",
    "minecraft:operation": "./minecraft/operation",
    "minecraft:objective": "./minecraft/objective",
    "minecraft:scoreboard_slot": "./minecraft/scoreboard_slot",
    "minecraft:block": "./minecraft/block",
    "minecraft:block_pos": "./minecraft/block_pos",
    "minecraft:nbt": "./minecraft/nbt",
};

export function getParser(node: CommandNode): Parser | void {
    let parserPath: string;
    if (node.type === "literal") {
        parserPath = "./literal";
    } else if (node.type === "argument") {
        parserPath = getArgParserPath(node.parser);
    } else {
        throw new Error(`${JSON.stringify(node)} does not have an attached parser because its type is not a literal or argument node. Please consider reporting this at https://github.com/Levertion/mcfunction-language-server/issues`);
    }
    if (parserPath.length > 0) {
        try {
            return require(parserPath).parser;
        } catch (error) {
            mcfunctionLog(`No parser was found at ${parserPath}. Please consider reporting this at https://github.com/Levertion/mcfunction-language-server/issues, along with: ${JSON.stringify(error)}.`);
        }
    }
}

function getArgParserPath(id: string): string {
    if (defaultParsers.hasOwnProperty(id)) {
        return defaultParsers[id];
    } else {
        mcfunctionLog(`Argument with parser id ${id} has no associated parser. Please consider reporting this at https://github.com/Levertion/mcfunction-language-server/issues`);
        return "";
    }
}
