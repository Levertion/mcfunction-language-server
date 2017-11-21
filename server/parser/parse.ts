import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/lib/main";
import { NodeRange } from "../document-information";
import { Arg, Properties } from "./arguments";
import { BooleanArgument } from "./brigadier/boolean";
import { FloatArgument } from "./brigadier/float";
import { IntegerArgument } from "./brigadier/integer";
import { StringArgument } from "./brigadier/string";
import { McError } from "./exceptions";
import { LiteralArgument } from "./literal";
import { StringReader } from "./string-reader";

export interface CommandNode {
    type: "root" | "literal" | "argument";
    children?: { [key: string]: CommandNode };
    parser?: string;
    properties?: Properties;
    executable?: true;
    redirect?: string[];
}

/**
 * A dictionary of parser keys as defined in tree.json into actual parsers
 */
const Parsers: { [s: string]: Arg } = {
    "brigadier:string": StringArgument,
    "brigadier:integer": IntegerArgument,
    "brigadier:float": FloatArgument,
    "brigadier:bool": BooleanArgument,
};

interface CommandParseResult {
    diagnostic?: Diagnostic;
    nodes: NodeRange[];
}

interface AgainstNodeResult {
    diagnostic?: Diagnostic;
    nodes: NodeRange[];
    successful: boolean;
}

function parseAgainstNode(node: CommandNode, reader: StringReader, key: string, line: number): AgainstNodeResult {
    let diagnostic: Diagnostic;
    let successful: boolean = false;
    const properties: Properties = node.properties || { key };
    properties.key = key;
    const nodes: NodeRange[] = [];
    const start = reader.cursor;
    switch (node.type) {
        case "literal":
            try {
                LiteralArgument.parse(reader, properties);
                successful = true;
            } catch (error) {
                if (!(error instanceof McError)) {
                    throw error;
                }
            }
            break;
        case "argument":
            try {
                const parser = Parsers[node.parser];
                parser.parse(reader, node.properties);
                successful = true;
            } catch (error) {
                if (error instanceof McError) {
                    diagnostic = Diagnostic.create(
                        { start: { line, character: error.start }, end: { line, character: error.end === -1 ? reader.string.length : error.end } },
                        error.computed, DiagnosticSeverity.Error, error.type, "mcfunction");
                } else {
                    throw error;
                }
            }
            break;
        case "root":
            reader.cursor--; // Ignore the space added by default
            successful = true;
        default:
            break;
    }
    if (successful) {
        nodes.push({ low: start, high: reader.cursor, key });
        reader.skip(); // Add in space
        if (reader.canRead()) {
            let tree: CommandNode;
            if (!!node.redirect) {
                tree = getRedirectedNode(node.redirect);
            } else {
                tree = node;
            }
            const childResult = testChildren(tree, reader, line);
            diagnostic = childResult.diagnostic;
            nodes.concat(childResult.nodes);
            successful = childResult.successful;
        }
    }
    return { diagnostic, nodes, successful };
}

function testChildren(node: CommandNode, reader: StringReader, line: number): AgainstNodeResult {
    let diagnostic: Diagnostic;
    const nodes: NodeRange[] = [];
    let successful: boolean = false;
    const begin: number = reader.cursor;
    // tslint:disable-next-line:forin
    for (const childKey in node.children) {
        const parseResult = parseAgainstNode(node.children[childKey], reader, childKey, line);
        nodes.concat(parseResult.nodes);
        diagnostic = parseResult.diagnostic;
        if (parseResult.successful) {
            successful = true;
            break;
        }
        reader.cursor = begin;
    }
    if (!successful && diagnostic !== null) {
        diagnostic = Diagnostic.create({ start: { line, character: begin }, end: { line, character: reader.string.length } }, `No node which matched ${reader.getRemaining()}.`, DiagnosticSeverity.Error, "levertion.node.notfound", "mcfunction");
    }
    return { diagnostic, nodes, successful };
}

export function parseCommand(command: string, line: number, tree: CommandNode): CommandParseResult {
    const reader = new StringReader(command);
    const parseResult = parseAgainstNode(tree, reader, "null", line);
    return { diagnostic: parseResult.diagnostic, nodes: parseResult.nodes };
}
