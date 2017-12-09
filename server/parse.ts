import { Diagnostic, DiagnosticSeverity, IConnection } from "vscode-languageserver/lib/main";
import { ARGUMENTSEPERATOR } from "./consts";
import { literalArgumentParser } from "./parsers/literal";
import { StringReader } from "./string-reader";
import { CommandNode, CommandSyntaxException, FunctionDiagnostic, NodePath, NodeProperties, NodeRange, ParseResult, ServerInformation, toDiagnostic } from "./types";

const PARSEEXCEPTIONS = {
    NoChildren: new CommandSyntaxException("The node has no children but there are more characters following it", "command.parsing.childless"),
    MissingArgSep: new CommandSyntaxException("Expected whitespace: got %s", "command.parsing.whitespace"),
    IncompleteCommand: new CommandSyntaxException("The command %s is not a commmand which can be run", "command.parsing.incomplete"),
    NoSuccesses: new CommandSyntaxException("No nodes which matched %s found", "command.parsing.matchless"),
    UnexpectedSeperator: new CommandSyntaxException(`Unexpected trailing argument seperator ${ARGUMENTSEPERATOR}`, "command.parsing.trailing", DiagnosticSeverity.Warning),
};

// Exported only to allow assertion of a lines to parse in the "getDocumentLines" callback, which normally has an any type
export interface LinesToParse {
    uri: string;
    lines: string[];
    numbers: number[];
}
export function parseLines(value: LinesToParse, serverInfo: ServerInformation, connection: IConnection) {
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
    sendDiagnostics(serverInfo, connection, value.uri);
}

function sendDiagnostics(serverInfo: ServerInformation, connection: IConnection, uri: string) {
    const diagnostics: Diagnostic[] = [];
    for (let i = 0; i < serverInfo.documentsInformation[uri].lines.length; i++) {
        const diagnostic = serverInfo.documentsInformation[uri].lines[i];
        if (diagnostic.issue) {
            diagnostics.push(toDiagnostic(diagnostic.issue, i));
        }
    }
    connection.sendDiagnostics({ uri, diagnostics });
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
                        if (reader.peek() !== ARGUMENTSEPERATOR && reader.canRead()) {
                            // This is to avoid repetition.
                            throw {};
                        }
                        successful = childKey;
                        issue = null;
                        nodes.push();
                        break child_loop;
                    } catch (error) {
                        reader.cursor = begin;
                        serverInfo.logger(`${JSON.stringify(error)}`);
                    }
                    break;
                case "argument":
                    // Temporary - parsers must be implemented first
                    serverInfo.logger("Argument child reached");
                    if (!successful) {
                        try {

                        } catch (error) {
                            reader.cursor = begin;
                            issue = error;
                        }
                    }
                    continue child_loop;
                default:
                    // Mangled input. Easiest to leave for the moment
                    break;
            }
        }
    }
    if (!!successful) {
        if (reader.canRead()) {
            if (reader.peek() === ARGUMENTSEPERATOR) {
                if (!!node.children[successful].children) {
                    reader.skip();
                    const parseResult = parseChildren(node.children[successful], reader, newPath, serverInfo);
                    issue = parseResult.issue;
                    nodes.concat(parseResult.nodes);
                } else {
                    issue = PARSEEXCEPTIONS.NoChildren.create(reader.cursor + 1, reader.string.length, reader.getRemaining());
                }
            } else {
                issue = PARSEEXCEPTIONS.MissingArgSep.create(reader.cursor, reader.string.length, reader.string.substring(reader.cursor));
            }
        } else if (!node.children[successful].executable) {
            issue = PARSEEXCEPTIONS.IncompleteCommand.create(0, reader.string.length, reader.string);
        } else if (reader.peek() === ARGUMENTSEPERATOR) {
            issue = PARSEEXCEPTIONS.UnexpectedSeperator.create(reader.cursor, reader.cursor);
        }
    } else if (!issue) {
        issue = PARSEEXCEPTIONS.NoSuccesses.create(begin, reader.string.length, reader.getRemaining());
    }
    return { nodes, issue };
}
