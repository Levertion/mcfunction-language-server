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
    createConnection, Diagnostic, TextDocumentSyncKind,
} from "vscode-languageserver";
import { DocLine, DocumentInformation, getChangedLines, NodeRange } from "./document-information";
import { CommandNode, parseCommand } from "./parser/parse";

// Creates the LSP connection
const connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a manager for open text documents
const documentsInformation: { [uri: string]: DocumentInformation } = {};
interface GetLineResult {
    lines: string[];
    numbers: number[];
}
connection.listen();
// The workspace folder this server is operating on
let workspaceFolder: string;

const commandTree: CommandNode = {
    type: "root", children: {
        test1: { type: "literal" },
        test2: {
            type: "literal",
            children: {
                int: {
                    type: "argument",
                    parser: "brigadier:integer",
                    properties: {
                        // @ts-ignore due to the way properties are implemented, this is invalid for properties but valid for an actual tree.
                        min: -10,
                        max: 100,
                    },
                },
            },
        },
    },
};
connection.onInitialize((params) => {
    workspaceFolder = params.rootUri;
    connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Started and initialize received`);
    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: TextDocumentSyncKind.Incremental,
            },
        },
    };
});

connection.onDidChangeConfiguration(() => {
    connection.console.log("Config Change successful");
    // Temp
});

connection.onDidChangeTextDocument((event) => {
    connection.sendDiagnostics({ uri: event.textDocument.uri, diagnostics: [] }); // Clear existing diagnostics
    const uri: string = event.textDocument.uri;
    let changedLines: number[] = [];
    event.contentChanges.forEach((change) => {
        const result = getChangedLines(change, changedLines);
        changedLines = result.tracker;
        // Remove the changed lines, and then refill the new needed ones with empty trees. Probably needs testing :)
        documentsInformation[uri].lines.splice(Math.min(...result.tracker), result.tracker.length, ...Array<DocLine>(result.tracker.length).fill({ Nodes: new IntervalTree<NodeRange>() }));
    });
    connection.console.log(`New lines: ${JSON.stringify(changedLines)}`);
    connection.sendRequest("getDocumentLines", event.textDocument, changedLines).then((value) => LinesGot(value as GetLineResult, uri), (reason) => { connection.console.log(`Get Document lines rejection reason: ${JSON.stringify(reason)}`); });
});

connection.onDidOpenTextDocument((params) => {
    connection.console.log("Document Opened");
    const lines = params.textDocument.text.split(/\r?\n/g);
    documentsInformation[params.textDocument.uri] = { lines: new Array<DocLine>(lines.length).fill({ Nodes: new IntervalTree<NodeRange>() }) };
    LinesGot({ lines, numbers: Array<number>(lines.length).fill(0).map<number>((_, i) => i) }, params.textDocument.uri);
});

connection.onDidCloseTextDocument((params) => {
    connection.console.log("Document Closed");
    delete documentsInformation[params.textDocument.uri];
});

function LinesGot(value: GetLineResult, uri: string) {
    if (value) { // Textdocument change event is sent even when a text document closes?
        for (let i = 0; i < value.lines.length; i++) {
            const line = value.lines[i];
            const num = value.numbers[i];
            const lineInfo = documentsInformation[uri].lines[num]; // Index out of bounds
            const parseResult = parseCommand(line, num, commandTree);
            lineInfo.issue = parseResult.diagnostic;
            if (lineInfo.issue.range.end.character === -1) {
                lineInfo.issue.range.end.character = line.length;
            }
            parseResult.nodes.forEach((node) => {
                lineInfo.Nodes.insert(node);
            });
        }
        connection.sendDiagnostics({
            uri, diagnostics: documentsInformation[uri].lines.filter((line) => line.issue !== null).map<Diagnostic>((line) => {
                const diagnostic = line.issue;
                return diagnostic;
            }),
        });
    }
}
