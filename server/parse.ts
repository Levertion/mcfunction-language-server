import { Diagnostic, DiagnosticSeverity, IConnection } from "vscode-languageserver/lib/main";
import { ARGUMENTSEPERATOR, COMMENTSTART } from "./consts";
import { boolArgumentParser } from "./parsers/bool";
import { floatArgumentParser } from "./parsers/float";
import { integerArgumentParser } from "./parsers/integer";
import { literalArgumentParser } from "./parsers/literal";
import { stringArgumentParser } from "./parsers/string";
import { StringReader } from "./string-reader";
import { CommandNode, CommandSyntaxException, FunctionDiagnostic, NodePath, NodeProperties, NodeRange, Parser, ParseResult, ServerInformation, toDiagnostic } from "./types";

const PARSEEXCEPTIONS = {
    NoChildren: new CommandSyntaxException("The node has no children but there are more characters following it", "command.parsing.childless"),
    MissingArgSep: new CommandSyntaxException("Expected whitespace: got %s", "command.parsing.whitespace"),
    IncompleteCommand: new CommandSyntaxException("The command %s is not a commmand which can be run", "command.parsing.incomplete"),
    NoSuccesses: new CommandSyntaxException("No nodes which matched %s found", "command.parsing.matchless"),
    UnexpectedSeperator: new CommandSyntaxException(`Unexpected trailing argument seperator ${ARGUMENTSEPERATOR}`, "command.parsing.trailing", DiagnosticSeverity.Warning),
};

const parsers: { [key: string]: Parser } = {
    "brigadier:bool": boolArgumentParser,
    "brigadier:float": floatArgumentParser,
    "brigadier:integer": integerArgumentParser,
    "brigadier:string": stringArgumentParser,
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
        if (text.length > 0 && !text.startsWith(COMMENTSTART)) {
            const reader = new StringReader(text);
            const result = parseChildren(serverInfo.tree, reader, [], serverInfo);
            info.issue = result.issue;
            for (const node of result.nodes) {
                info.Nodes.insert(node);
            }
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
            const childProperties: NodeProperties = (child.properties || {}) as NodeProperties;
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
                        nodes.push({ key: childKey, high: reader.cursor, path: newPath, low: begin });
                        break child_loop;
                    } catch (error) {
                        reader.cursor = begin;
                    }
                    break;
                case "argument":
                    serverInfo.logger(`Argument Child ${childKey}`);
                    if (!successful) {
                        try {
                            // Will need to try the parser of child
                            // It will log if the parser is not recognised, with an explanation messages
                            // It will add a node to nodes with the path and key.
                            // Possibly need a way for subparsers to send further nodes - worth looking into after first working draft.
                            if (parsers.hasOwnProperty(child.parser)) {
                                const parser = parsers[child.parser];
                                parser.parse(reader, childProperties, serverInfo);
                                issue = null;
                                successful = childKey;
                                nodes.push({ key: childKey, high: reader.cursor, path: newPath, low: begin });
                            }
                        } catch (error) {
                            reader.cursor = begin;
                            issue = error;
                        }
                    }
                    break;
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
                    nodes.push(...parseResult.nodes);
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
