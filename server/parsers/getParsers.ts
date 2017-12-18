import { Parser } from "../types";

const defaultParsers: { [id: string]: string } = {
    "brigadier:integer": "./brigadier/integer",
    "brigadier:float": "./brigadier/float",
    "brigadier:bool": "./brigadier/bool",
    "brigadier:string": "./brigadier/string",
};

const parserCache: { [id: string]: Parser } = {};

export function getParser(id: string,
    //  serverInfo: ServerInformation for possibly allowing custom parsers using a setting.
): Parser {
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
        throw Error(`No parser with id ${id} found.`);
    }
}
