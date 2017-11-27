import { Diagnostic } from "vscode-languageserver/lib/main";
import { StringReader } from "./brigadier-implementations";
import { literalArgumentParser } from "./parsers/literal";
import { CommandNode, CommandSyntaxException, FunctionDiagnostic, NodePath, NodeProperties, NodeRange, ParseResult, ServerInformation, toDiagnostic } from "./types";

// Exported only to allow assertion of a lines to parse in the "getDocumentLines" callback, which normally has an any type
export interface LinesToParse {
    uri: string;
    lines: string[];
    numbers: number[];
}
export function parseLines(value: LinesToParse, serverInfo: ServerInformation) {
    for (let index = 0; index < value.numbers.length; index++) {
        const text = value.lines[index];
        const lineNo = value.numbers[index];
        const info = serverInfo.documentsInformation[value.uri].lines[lineNo];
        if (text.length > 0 && !text.startsWith("#")) {
            const reader = new StringReader(text);
            const result = parseChildren(serverInfo.tree, reader, [], serverInfo);
            info.issue = result.issue;
            /* for (const node of result.nodes) {
                info.Nodes.insert(node);
            } */
        }
    }
    const diagnostics: Diagnostic[] = [];
    for (let i = 0; i < serverInfo.documentsInformation[value.uri].lines.length; i++) {
        const diagnostic = serverInfo.documentsInformation[value.uri].lines[i];
        if (diagnostic.issue) {
            diagnostics.push(toDiagnostic(diagnostic.issue, i));
        }
    }
    serverInfo.connection.sendDiagnostics({ uri: value.uri, diagnostics });
}

function parseChildren(node: CommandNode, reader: StringReader, path: NodePath, serverInfo: ServerInformation): ParseResult {
    const begin = reader.cursor;
    const nodes: NodeRange[] = [];
    let successful: string;
    let newPath: NodePath;
    let issue: FunctionDiagnostic;
    child_loop:
    for (const childKey in node.children) {
        if (node.children.hasOwnProperty(childKey)) {
            const child = node.children[childKey];
            const childProperties: NodeProperties = child.properties || {} as NodeProperties;
            newPath = path.slice(); // Clone old to new - https://stackoverflow.com/a/7486130
            newPath.push(childKey);
            childProperties.key = childKey;
            childProperties.path = newPath;
            switch (child.type) {
                case "literal":
                    try {
                        literalArgumentParser.parse(reader, childProperties);
                        successful = childKey;
                        nodes.push();
                        break child_loop;
                    } catch (error) {
                        reader.cursor = begin;
                        serverInfo.connection.console.error(`${JSON.stringify(error)}`);
                    }
                    break;
                case "argument":
                    // Temporary - parsers must be implemented first
                    serverInfo.connection.console.log("Argument child reached");
                    break;
                default:
                    // Mangled input. Easiest to leave for the moment
                    break;
            }
        }
    }
    if (!!successful) {
        if (reader.canRead()) {
            if (!!node.children[successful].children) {
                if (reader.peek(1) === " ") {
                    reader.cursor += 2;
                    const parseResult = parseChildren(node.children[successful], reader, newPath, serverInfo);
                    issue = parseResult.issue;
                    nodes.concat(parseResult.nodes);
                } else {
                    issue = new CommandSyntaxException("Expected whitespace: got %s", "command.parsing.whitespace").create(reader.cursor, reader, reader.string.substring(reader.cursor));
                }
            } else {
                issue = new CommandSyntaxException("The node has no children but there are more characters following it", "command.parsing.childless").create(reader.cursor + 1, reader, reader.getRemaining());
            }
        } else if (!node.children[successful].executable) {
            issue = new CommandSyntaxException("The command %s is not a commmand which can be run", "command.parsing.incomplete").create(0, reader, reader.string);
        }
    } else if (!issue) {
        issue = new CommandSyntaxException("No nodes which matched %s found", "command.parsing.matchless").create(begin, reader, reader.getRemaining());
    }
    return { nodes, issue };
}
