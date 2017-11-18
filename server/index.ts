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
    createConnection, TextDocuments,
} from "vscode-languageserver";
import { DocumentInformation, getChangedLines, NodeRange, DocLine } from "./document-information";

// Creates the LSP connection
const connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a manager for open text documents
const documents = new TextDocuments();

const documentsInformation: { [uri: string]: DocumentInformation } = {};

// The workspace folder this server is operating on
let workspaceFolder: string;

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


connection.onDidChangeTextDocument((event) => {
    let changedLines: number[] = [];
    const documentInfo = documentsInformation[event.textDocument.uri];
    event.contentChanges.forEach((change) => {
        const result = getChangedLines(change, changedLines);
        changedLines = result.tracker;
        const linesChange = result.linesChange;
        // Remove the changed lines, and then refill the new needed ones with empty trees. Probably needs testing :)
        documentInfo.lines.splice(linesChange.newLine, linesChange.oldLine, ...Array<DocLine>(linesChange.oldLine - linesChange.newLine).fill({ Nodes: new IntervalTree<NodeRange>() }));
    });
    documentsInformation[event.textDocument.uri] = documentInfo;
    changedLines.forEach((line) => {
        line.valueOf();
    });
});

documents.onDidOpen((event) => {
    connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Document opened: ${event.document.uri}`);
});

documents.listen(connection);
connection.listen();
