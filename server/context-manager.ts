import deepmerge = require("deepmerge");
import Fs = require("fs");
import Path = require("path");
import { vsprintf } from "sprintf-js";
import { CommandContext } from "./types";

const contextPaths: ContextNode = JSON.parse(Fs.readFileSync(Path.resolve(__dirname, "../information/command-context.json")).toString());

interface ContextNode {
    children: {
        [key: string]: ContextNode,
    };
    context: CommandContext["commandInfo"];
}

export function getContextForPath(path: string[], existingContext: CommandContext, args: string[]): CommandContext {
    const out: CommandContext = existingContext;
    if (out.commandInfo === undefined) {
        out.commandInfo = {};
    }
    let lastNode = contextPaths;
    for (const s of path) {
        if (lastNode.context !== undefined) {
            lastNode.context = mapFinalNode(lastNode.context, (n) => vsprintf(n.toString(), args));
            out.commandInfo = deepmerge(out.commandInfo, lastNode.context);
        }
        if (lastNode.children === undefined || !Object.keys(lastNode.children).includes(s)) {
            break;
        }
        lastNode = lastNode.children[s];
    }
    return out;
}

function mapFinalNode(obj: any, callback: (n: object) => void) {
    const out: any = {};
    for (const o of Object.keys(obj)) {
        if (typeof obj[o] === "object" && obj[o] !== null) {
            out[o] = mapFinalNode(obj[o], callback);
        } else {
            out[o] = callback(obj[o]);
        }
    }
    return out;
}
