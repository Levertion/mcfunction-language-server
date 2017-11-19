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
}

function parseAgainstNode(node: CommandNode, reader: StringReader, key: string, line: number): AgainstNodeResult | null {
    let diagnostic: Diagnostic;
    const properties: Properties = node.properties || { key };
    properties.key = key;
    const nodes: NodeRange[] = [];
    const start = reader.cursor;
    if (node.type === "literal") {
        try {
            LiteralArgument.parse(reader, properties);
        } catch (error) {
            if (!(error instanceof McError)) {
                throw error;
            }
        }
    } else if (node.type === "argument") {
        try {
            const parser = Parsers[node.parser];
            parser.parse(reader, node.properties);
        } catch (error) {
            if (error instanceof McError) {
                diagnostic = {
                    code: error.type, message: error.computed, severity: DiagnosticSeverity.Error, source: "mcfunction", range: {
                        start: {
                            line,
                            character: error.start,
                        },
                        end: {
                            line,
                            character: error.end,
                        },
                    },
                };
            } else {
                throw error;
            }
        }
    }
    if (!diagnostic) {
        nodes.push({ low: start, high: reader.cursor, key });
        reader.skip();
        // tslint:disable-next-line:forin
        for (const childKey in node.children) {
            const parseResult = parseAgainstNode(node.children[childKey], reader, childKey, line);
            if (parseResult) {
                nodes.concat(parseResult.nodes);
                diagnostic = parseResult.diagnostic;
            }
        }
    }
    return { diagnostic, nodes };
}

export function parseCommand(command: string, line: number, tree: CommandNode): CommandParseResult {
    const reader = new StringReader(command);
    const parseResult = parseAgainstNode(tree, reader, "null", line);
    return { diagnostic: parseResult.diagnostic, nodes: parseResult.nodes };
}
