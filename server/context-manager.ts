import fs = require("fs");
import { CommandContext } from "./types";

const contextPaths: ContextNode = JSON.parse(fs.readFileSync("../information/command-context.json").toString());

interface ContextNode {
    children: {
        [key: string]: ContextNode,
    };
    context: CommandContext["commandInfo"];
}

export function getContextForPath(path: string[], existingContext: CommandContext): CommandContext {
    const out: CommandContext = existingContext;
    let lastNode = contextPaths;
    for (const s of path) {
        if (!Object.keys(lastNode.children).includes(s)) {
            break;
        }
        lastNode = lastNode.children[s];
        Object.assign(out.commandInfo, lastNode.context);
    }
    return out;
}
