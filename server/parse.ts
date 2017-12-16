import isEqual = require("lodash.isequal");
import { Diagnostic, DiagnosticSeverity, IConnection } from "vscode-languageserver/lib/main";
import { ARGUMENTSEPERATOR, COMMENTSTART } from "./consts";
import { boolArgumentParser } from "./parsers/bool";
import { floatArgumentParser } from "./parsers/float";
import { integerArgumentParser } from "./parsers/integer";
import { literalArgumentParser } from "./parsers/literal";
import { stringArgumentParser } from "./parsers/string";
import { StringReader } from "./string-reader";
import { CommandContext, CommandNode, CommandSyntaxException, FunctionDiagnostic, NodePath, NodeProperties, NodeRange, Parser, ParseResult, ServerInformation, toDiagnostic } from "./types";

const PARSEEXCEPTIONS = {
    NoChildren: new CommandSyntaxException("The node has no children but there are more characters following it", "command.parsing.childless"),
    MissingArgSep: new CommandSyntaxException("Expected whitespace: got %s", "command.parsing.whitespace"),
    IncompleteCommand: new CommandSyntaxException("The command %s is not a commmand which can be run", "command.parsing.incomplete", DiagnosticSeverity.Warning),
    NoSuccesses: new CommandSyntaxException("No nodes which matched %s found", "command.parsing.matchless"),
    UnexpectedSeperator: new CommandSyntaxException(`Unexpected trailing argument seperator '${ARGUMENTSEPERATOR}'`, "command.parsing.trailing", DiagnosticSeverity.Warning),
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
            const context: CommandContext = { executortype: "any", fileUri: value.uri, server: serverInfo };
            const reader = new StringReader(text);
            const result = parseChildren(serverInfo.tree, reader, [], context);
            info.issue = result.issue;
            info.nodes.push(...result.nodes);
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

function parseChildren(node: CommandNode, reader: StringReader, path: NodePath, context: CommandContext): ParseResult {
    const begin = reader.cursor;
    const nodes: NodeRange[] = [];
    let successful: NodeRange;
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
                    const beforeParse = reader.cursor;
                    reader.cursor = begin;
                    try {
                        literalArgumentParser.parse(reader, childProperties);
                        if (reader.peek() !== ARGUMENTSEPERATOR && !reader.endRead) {
                            // This is to avoid repetition.
                            throw {};
                        }
                        successful = { key: childKey, high: reader.cursor, path: newPath, low: begin };
                        issue = null;
                        break child_loop;
                    } catch (error) {
                        reader.cursor = beforeParse;
                    }
                    break;
                case "argument":
                    context.server.logger(`Argument Child ${childKey}`);
                    if (!successful) {
                        const oldContext = context;
                        // Deep clone.
                        const newContext = JSON.parse(JSON.stringify(context));
                        try {
                            // Will need to try the parser of child
                            // It will log if the parser is not recognised, with an explanation messages
                            // It will add a node to nodes with the path and key.
                            // Possibly need a way for subparsers to send further nodes - worth looking into after first working draft.
                            if (parsers.hasOwnProperty(child.parser)) {
                                const parser = parsers[child.parser];
                                parser.parse(reader, childProperties, newContext);
                                if (reader.peek() === ARGUMENTSEPERATOR || reader.endRead) {
                                    issue = null;
                                    if (isEqual(newContext, oldContext)) {
                                        context = newContext;
                                    }
                                    if (reader.endRead) {
                                        successful = { key: childKey, high: reader.cursor + 1, path: newPath, low: begin, context };
                                    } else {
                                        successful = { key: childKey, high: reader.cursor, path: newPath, low: begin, context };
                                    }
                                } else {
                                    throw PARSEEXCEPTIONS.MissingArgSep.create(reader.cursor, reader.string.length, reader.string.substring(reader.cursor));
                                }
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
    if (!!successful && !issue) {
        if (reader.canRead()) {
            if (!!node.children[successful.key].children) {
                reader.skip();
                if (!reader.endRead) {
                    const parseResult = parseChildren(node.children[successful.key], reader, newPath, context);
                    issue = parseResult.issue;
                    nodes.push(...parseResult.nodes);
                }
            } else {
                issue = PARSEEXCEPTIONS.NoChildren.create(reader.cursor, reader.string.length, reader.getRemaining());
            }
        } else if (!node.children[successful.key].executable) {
            issue = PARSEEXCEPTIONS.IncompleteCommand.create(0, reader.string.length, reader.string);
        } else if (reader.peek() === ARGUMENTSEPERATOR) {
            issue = PARSEEXCEPTIONS.UnexpectedSeperator.create(reader.cursor, reader.cursor + 1);
        }
    } else if (!issue) {
        issue = PARSEEXCEPTIONS.NoSuccesses.create(begin, reader.string.length, reader.getRemaining());
    }
    if (!!successful) {
        nodes.push(successful);
    }
    return { nodes, issue };
}
