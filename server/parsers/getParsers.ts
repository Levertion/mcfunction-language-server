import { Parser, ServerInformation } from "../types";

const defaultParsers: { [id: string]: string } = {
    "brigadier:integer": "./brigadier/integer",
    "brigadier:float": "./brigadier/float",
    "brigadier:bool": "./brigadier/bool",
    "brigadier:string": "./brigadier/string",
    "minecraft:swizzle": "./minecraft/swizzle",
    "minecraft:operation": "./minecraft/operation",
    "minecraft:objective": "./minecraft/objective",
    "minecraft:scoreboard_slot": "./minecraft/scoreboard_slot",
};

const parserCache: { [id: string]: Parser } = {};

export function getParser(id: string, serverInfo: ServerInformation, // Also for possibly allowing custom parsers using a setting.
): Parser | void {
    if (defaultParsers.hasOwnProperty(id)) {
        if (!parserCache.hasOwnProperty(id)) {
            try {
                parserCache[id] = require(defaultParsers[id] as string).parser as Parser;
            } catch (error) {
                throw Error(`Parser at path ${defaultParsers[id]} not found.`);
            }
        }
        return parserCache[id];
    } else {
        serverInfo.logger(`No parser with id ${id} found.`);
        return;
    }
}
