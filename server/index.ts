/*---------------------------------------------------------
* Originally copied from:
* https://github.com/Microsoft/vscode-extension-samples/tree/master/lsp-multi-server-sample
* Origin under the MIT license: Copyright (C) Microsoft Corporation. All rights reserved.
* This version under the MIT license as in the project root
*-------------------------------------------------------*/
"use strict";

import { IntervalTree } from "node-interval-tree";
import { IPCMessageWriter } from "vscode-jsonrpc";
import { IPCMessageReader } from "vscode-jsonrpc/lib/messageReader";
import {
    createConnection, Diagnostic, TextDocuments,
} from "vscode-languageserver";
import { DocLine, DocumentInformation, getChangedLines, NodeRange } from "./document-information";
import { CommandNode, parseCommand } from "./parser/parse";

// Creates the LSP connection
const connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a manager for open text documents
const documents = new TextDocuments();

const documentsInformation: { [uri: string]: DocumentInformation } = {};

documents.listen(connection);
connection.listen();
// The workspace folder this server is operating on
let workspaceFolder: string;

let commandTree: CommandNode;
connection.onInitialize((params) => {
    workspaceFolder = params.rootUri;
    connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Started and initialize received`);
    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: documents.syncKind,
            },
        },
    };
});

connection.onDidChangeConfiguration(() => {
    connection.console.log("Config Change successful");
    // Temp
    commandTree = {
        type: "root", children: {
            test1: { type: "literal" },
            test2: {
                type: "literal",
                children: {
                    int: {
                        type: "argument",
                        parser: "brigadier:integer",
                        properties: {
                            // @ts-ignore
                            min: -10,
                            max: 100,
                        },
                    },
                },
            },
        },
    };
    connection.console.log(JSON.stringify(commandTree));
});

connection.onDidChangeTextDocument((event) => {
    connection.console.log(JSON.stringify(event));
    let changedLines: number[] = [];
    const documentInfo = documentsInformation[event.textDocument.uri];
    event.contentChanges.forEach((change) => {
        connection.console.log(JSON.stringify(change));
        const result = getChangedLines(change, changedLines);
        changedLines = result.tracker;
        const linesChange = result.linesChange;
        // Remove the changed lines, and then refill the new needed ones with empty trees. Probably needs testing :)
        documentInfo.lines.splice(linesChange.newLine, linesChange.oldLine, ...Array<DocLine>(linesChange.oldLine - linesChange.newLine).fill({ Nodes: new IntervalTree<NodeRange>() }));
    });
    const lines: string[] = documents.get(event.textDocument.uri).getText().split(/\n/g);
    connection.console.log(JSON.stringify(changedLines));
    changedLines.forEach((line) => {
        connection.console.log(JSON.stringify(line));
        const parseResult = parseCommand(lines[line], line, commandTree);
        documentInfo.lines[line].issue = parseResult.diagnostic;
        parseResult.nodes.forEach((node) => {
            documentInfo.lines[line].Nodes.insert(node);
        });
    });
    documentsInformation[event.textDocument.uri] = documentInfo;
    connection.sendDiagnostics({
        uri: event.textDocument.uri, diagnostics: documentInfo.lines.filter((line) => line.issue !== null).map<Diagnostic>((line) => {
            const diagnostic = line.issue;
            if (diagnostic.range.end.character === - 1) {
                diagnostic.range.end.character = lines[diagnostic.range.end.line].length;
            }
            return diagnostic;
        }),
    });
});

documents.onDidOpen((event) => {
    connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Document opened: ${event.document.uri}`);
});
