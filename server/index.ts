/*---------------------------------------------------------
 * Originally copied from:
 * https://github.com/Microsoft/vscode-extension-samples/tree/master/lsp-multi-server-sample
 * Origin under the MIT license: Copyright (C) Microsoft Corporation. All rights reserved.
 * This version under the MIT license as in the project root
 *-------------------------------------------------------*/
'use strict';

import {
    createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind
} from 'vscode-languageserver';

// Creates the LSP connection
let connection = createConnection(ProposedFeatures.all);
// Create a manager for open text documents

let documents = new TextDocuments();

// The workspace folder this server is operating on
let workspaceFolder: string;

documents.onDidOpen((event) => {
    connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Document opened: ${event.document.uri}`);
})
documents.listen(connection);

connection.onInitialize((params) => {
    workspaceFolder = params.rootUri;
    connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Started and initialize received`);
    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: TextDocumentSyncKind.None
            }
        }
    }
});
connection.listen();
