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
    createConnection, TextDocumentSyncKind,
} from "vscode-languageserver";
import { LinesToParse, parseLines } from "./parse";
import { getChangedLines } from "./server-information";
import { DocLine, NodeRange, ServerInformation } from "./types";

// Creates the LSP connection
const connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

connection.listen();
/**
 * Information about the server.  
 * Initialised as invalid ServerInfo  
 * will be setup in connection.onInitialise, but needs to be accessed in module scope.
 */
const serverInfo: ServerInformation = {} as ServerInformation;
// Setup the server.
connection.onInitialize((params) => {
    serverInfo.workspaceFolder = params.rootUri;
    serverInfo.documentsInformation = {};
    serverInfo.connection = connection;
    serverInfo.tree = {
        type: "root", children: {
            test: { type: "literal", executable: true },
        },
    };
    connection.console.log(`[Server(${process.pid}) ${params.rootUri}] Started and initialize received`);
    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: TextDocumentSyncKind.Incremental,
            },
        },
    };
});

// This is where any configurations will come in
connection.onDidChangeConfiguration(() => {
    connection.console.log("Config Change successful");
    // Different settings go here. For example, custom JAR location for command tree recovery.
});

// Respond to one of the text documents changing.
connection.onDidChangeTextDocument((event) => {
    connection.sendDiagnostics({ uri: event.textDocument.uri, diagnostics: [] });
    const uri: string = event.textDocument.uri;
    const changedLines: number[] = [];
    for (const change of event.contentChanges) {
        const result = getChangedLines(change);
        changedLines.push(...result.tracker);
        // Remove the changed lines, and then refill the new needed ones with empty trees.
        serverInfo.documentsInformation[uri].lines.splice(result.newLine, result.changedNumber, ...Array(result.tracker.length).fill(0).map<DocLine>(() => ({ Nodes: new IntervalTree<NodeRange>() })));
    }
    // See https://stackoverflow.com/a/14438954. From discussion seems like this is the easiest way.
    changedLines.filter((value, index, self) => self.indexOf(value) === index);
    connection.sendRequest("getDocumentLines", event.textDocument, changedLines).then((value) => { if (value) { parseLines(value as LinesToParse, serverInfo); } }, (reason) => { connection.console.log(`Get Document lines rejection reason: ${JSON.stringify(reason)}`); });
});

connection.onDidOpenTextDocument((params) => {
    connection.console.log("Document Opened");
    const lines = params.textDocument.text.split(/\r?\n/g);
    serverInfo.documentsInformation[params.textDocument.uri] = { lines: new Array(lines.length).fill("U").map<DocLine>(() => ({ Nodes: new IntervalTree<NodeRange>() })) };
    parseLines({ lines, numbers: Array<number>(lines.length).fill(0).map<number>((_, i) => i), uri: params.textDocument.uri }, serverInfo);
});

connection.onDidCloseTextDocument((params) => {
    connection.console.log("Document Closed");
    delete serverInfo.documentsInformation[params.textDocument.uri];
});
