import { EventEmitter } from "events";
import { Diagnostic, DiagnosticSeverity, IConnection } from "vscode-languageserver/lib/main";
import { ARGUMENTSEPERATOR, COMMENTSTART } from "./consts";
import { getParentOfChildren, toDiagnostic } from "./miscUtils";
import { getParser } from "./parsers/getParser";
import { StringReader } from "./string-reader";
import { ArgRange, CommandContext, CommandIssue, CommandNode, CommandSyntaxException, DocLine, GivenProperties, NodePath, NodeProperties, ServerInformation } from "./types";

interface ArgResult {
    issue?: CommandIssue;
    successful: boolean;
}

export interface UnparsedLines {
    lines: string[];
    numbers: number[];
}

export function parseLines(lines: UnparsedLines, server: ServerInformation, uri: string, connection: IConnection, listener: EventEmitter) {
    for (let i = 0; i < lines.numbers.length; i++) {
        const command = lines.lines[i];
        const lineNo = lines.numbers[i];
        const docInfo = server.documentsInformation[uri];
        const docLines = docInfo.lines;
        if (command.length > 0) {
            if (!command.startsWith(COMMENTSTART)) {
                docLines[lineNo] = parse(command, server.tree, server.documentsInformation[uri].defaultContext.datapackFolder);
            } else {
                docLines[lineNo].comment = true;
                docLines[lineNo].parsing = false;
            }
        } else {
            docLines[lineNo].text = command;
            docLines[lineNo].parsing = false;
        }
        listener.emit(`${uri}${lineNo}`);
    }
    sendDiagnostics(server, connection, uri);
}

function sendDiagnostics(serverInfo: ServerInformation, connection: IConnection, uri: string) {
    const diagnostics: Diagnostic[] = [];
    for (let i = 0; i < serverInfo.documentsInformation[uri].lines.length; i++) {
        const line = serverInfo.documentsInformation[uri].lines[i];
        if (line.issue) {
            diagnostics.push(toDiagnostic(line.issue, i));
        }
    }
    connection.sendDiagnostics({ uri, diagnostics });
}

function parse(command: string, tree: CommandNode, datapackFolder: string): DocLine {
    const nodes: ArgRange[] = [];
    const reader = new StringReader(command);
    const context: CommandContext = { datapackFolder, executortype: "any", executionTypes: [] };
    const issue = parseNodeFollows(tree, reader, [], context, nodes, tree);
    return { text: command, issue, nodes };
}

function parseNodeFollows(node: CommandNode, reader: StringReader, path: NodePath, context: CommandContext, nodes: ArgRange[], tree: CommandNode): CommandIssue {
    const toParse = getParentOfChildren(path, tree);
    let issue: CommandIssue;
    if (toParse === false) {
        if (reader.canRead()) {
            issue = parseIssues.ExtraArgs.create(reader.cursor, reader.string.length, reader.getRemaining());
        }
        return issue;
    }
    const result = parseChildren(toParse[0], reader, toParse[1], context);
    if (!!result.successful) {
        reader.skip();
        nodes.push(result.successful);
        if (reader.canRead()) {
            issue = parseNodeFollows(toParse[0].children[result.successful.key], reader, result.successful.path, context, nodes, tree);
        } else if (!issue) {
            if (!node.executable) {
                issue = parseIssues.IncompleteCommand.create(0, reader.cursor, reader.getRead());
            }
            if (reader.peek(-1) === ARGUMENTSEPERATOR) {
                issue = parseIssues.UnexpectedSeperator.create(reader.cursor, reader.cursor - 1);
            }
        }
    } else if (!issue) {
        if (!!result.issue) {
            issue = result.issue;
        } else {
            issue = parseIssues.NoSuccesses.create(reader.cursor, reader.string.length, reader.getRemaining());
        }
    }
    return issue;
}

function parseChildren(node: CommandNode, reader: StringReader, path: NodePath, context: CommandContext) {
    let successful: ArgRange;
    let issue: CommandIssue;
    for (const childName of Object.keys(node.children)) {
        const begin = reader.cursor;
        const child = node.children[childName];
        const newPath: NodePath = Array(...path, childName);
        const props: NodeProperties = Object.assign<GivenProperties, NodeProperties>((child.properties || {}), { key: childName, path: newPath });
        const newContext = JSON.parse(JSON.stringify(context));
        const result = parseArgument(child, reader, props, newContext);
        if (result.successful) {
            if (reader.peek() !== ARGUMENTSEPERATOR && reader.canRead()) {
                if (!issue && !successful) {
                    issue = parseIssues.MissingArgSep.create(reader.cursor, reader.cursor + 1, reader.string.substring(reader.cursor));
                }
                reader.cursor = begin;
                continue;
            } else {
                issue = null;
                successful = { path: newPath, low: begin, high: reader.cursor, key: childName, context: newContext };
                context = newContext;
                reader.cursor = begin;
                if (child.type === "literal") {
                    break; // Prioritise matching literals over other arguments
                }
            }
        } else {
            if (child.type !== "literal") {
                issue = result.issue; // Don't give invalid literal issues.
            }
            reader.cursor = begin;
        }
    }
    if (!!successful) {
        reader.cursor = successful.high;
    }
    return { successful, issue };
}

function parseArgument(node: CommandNode, reader: StringReader, nodeProps: NodeProperties, argumentContext: CommandContext,
    // server: ServerInformation
): ArgResult {
    const parser = getParser(node);
    if (!!parser) {
        try {
            parser.parse(reader, nodeProps, argumentContext);
            return { successful: true };
        } catch (e) {
            return { issue: e, successful: false };
        }
    }
    return { successful: false };
}

const parseIssues = {
    MissingArgSep: new CommandSyntaxException("Expected whitespace: got %s", "command.parsing.seperator.missing"),
    ExtraArgs: new CommandSyntaxException("There are extra arguments for the command: %s", "command.parsing.extra"),
    NoSuccesses: new CommandSyntaxException("No nodes which matched '%s' found", "command.parsing.matchless"),
    IncompleteCommand: new CommandSyntaxException("The command %s is not a commmand which can be run", "command.parsing.incomplete", DiagnosticSeverity.Warning),
    UnexpectedSeperator: new CommandSyntaxException(`Unexpected trailing argument seperator '${ARGUMENTSEPERATOR}'`, "command.parsing.trailing", DiagnosticSeverity.Warning),
};
