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
    const uri: string = event.textDocument.uri;
    let changedLines: number[] = [];
    event.contentChanges.forEach((change) => {
        const result = getChangedLines(change, changedLines);
        changedLines = result.tracker;
        // Remove the changed lines, and then refill the new needed ones with empty trees. Probably needs testing :)
        documentsInformation[uri].lines.splice(result.newLine, result.oldLine - result.newLine + 1, ...Array<DocLine>(result.added).fill({ Nodes: new IntervalTree<NodeRange>() }));
    });
    connection.sendRequest("getDocumentLines", event.textDocument, changedLines).then((value) => { if (value) { LinesGot(value as GetLineResult, uri); } }, (reason) => { connection.console.log(`Get Document lines rejection reason: ${JSON.stringify(reason)}`); });
});

connection.onDidOpenTextDocument((params) => {
    connection.console.log("Document Opened");
    const lines = params.textDocument.text.split(/\r?\n/g);
    documentsInformation[params.textDocument.uri] = { lines: new Array(lines.length).fill("U").map<DocLine>(() => ({ Nodes: new IntervalTree<NodeRange>() })) };
    LinesGot({ lines, numbers: Array<number>(lines.length).fill(0).map<number>((_, i) => i) }, params.textDocument.uri);
});

connection.onDidCloseTextDocument((params) => {
    connection.console.log("Document Closed");
    delete documentsInformation[params.textDocument.uri];
});

function LinesGot(value: GetLineResult, uri: string) {
    for (let i = 0; i < value.lines.length; i++) {
        const line = value.lines[i];
        const num = value.numbers[i];
        const parseResult = parseCommand(line, num, commandTree);
        if (parseResult.diagnostic) {
            documentsInformation[uri].lines[num].issue = parseResult.diagnostic;
        }
        parseResult.nodes.forEach((node) => {
            if (node.high > node.low) {
                documentsInformation[uri].lines[num].Nodes.insert(node);
            }
        });
    }
    const diagnostics: Diagnostic[] = [];
    for (let i = 0; i < documentsInformation[uri].lines.length; i++) {
        const line = documentsInformation[uri].lines[i];
        if (line.issue) {
            line.issue.range.start.line = i;
            line.issue.range.end.line = i;
            diagnostics.push(line.issue);
        }
    }
    const calculatedDiagnostics = { uri, diagnostics };
    connection.console.log(JSON.stringify(calculatedDiagnostics));
    connection.sendDiagnostics({ uri, diagnostics: [] }); // Clear existing diagnostics
    connection.sendDiagnostics(calculatedDiagnostics);
}
