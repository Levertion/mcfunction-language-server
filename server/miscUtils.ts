import isEqual = require("lodash.isequal");
import * as path from "path";
import { Diagnostic } from "vscode-languageserver/lib/main";
import { dataFolderName } from "./consts";
import { CommandIssue, CommandNode, NodePath } from "./types";

/**
 * Find the datapacks folder a file is in
 * @param uri The URI of the file
 * @param normal The URI to fall back on (such as the workspace root)
 */
export function calculateDataFolder(uri: string, normal: string = ""): string {
    const packToSearch = path.sep + dataFolderName + path.sep;
    let packsFolderIndex = uri.lastIndexOf(packToSearch);
    if (packsFolderIndex !== -1) {
        packsFolderIndex += packToSearch.length;
        return uri.substring(0, packsFolderIndex);
    }
    return normal;
}

export function getNodeAlongPath(nodePath: NodePath, tree: CommandNode): CommandNode {
    let curTree = tree;
    for (const char of nodePath) {
        if (curTree.hasOwnProperty("children") && curTree.children.hasOwnProperty(char)) {
            curTree = curTree.children[char];
        } else {
            // Should never happen in normal operation, so just a standard Error.
            throw new Error(`Invalid tree path ${nodePath.join()} given to getNodeAlongPath`);
        }
    }
    return curTree;
}
/**
 * Convert a functionDiagnostic to a language server diagnostic
 * @param diagnosis The functionDiagnostic to convert
 * @param line The line number that the diagnostic is one
 */
export function toDiagnostic(diagnosis: CommandIssue, line: number): Diagnostic {
    return Diagnostic.create({
        start: { line, character: diagnosis.start },
        end: { line, character: diagnosis.end },
    }, diagnosis.message, diagnosis.severity, diagnosis.type, "mcfunction");
}

export function getParentOfChildren(nodePath: NodePath, tree: CommandNode): [CommandNode, NodePath] | false {
    const node = getNodeAlongPath(nodePath, tree);
    if (!!node.children) {
        return [node, nodePath];
    } else if (!!node.redirect) {
        return [getNodeAlongPath(node.redirect, tree), node.redirect];
    } else if (isEqual(nodePath, ["execute", "run"])) {
        return [tree, []];
    } else {
        return false;
    }
}
interface AnyObject { // Added to appease no implicit any
    [key: string]: any;
}
/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item: any): boolean {
    return (item && typeof item === "object" && !Array.isArray(item));
}

// https://stackoverflow.com/a/34749873/8728461
/**
 * Deep merge two objects.
 */
export function mergeDeep(target: AnyObject, ...sources: AnyObject[]): AnyObject {
    if (!sources.length) { return target; }
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) { Object.assign(target, { [key]: {} }); }
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return mergeDeep(target, ...sources);
}
