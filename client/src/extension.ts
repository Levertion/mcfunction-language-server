/*---------------------------------------------------------
 * Originally copied from:
 * https://github.com/Microsoft/vscode-extension-samples/tree/master/lsp-multi-server-sample
 * Origin under the MIT license: Copyright (C) Microsoft Corporation. All rights reserved.
 * This version under the MIT license as in the project root
 *-------------------------------------------------------*/
import * as path from 'path';
import {
    workspace as Workspace, window as Window, ExtensionContext, TextDocument, OutputChannel, WorkspaceFolder, Uri
} from 'vscode';
import {
    LanguageClient, LanguageClientOptions, TransportKind
} from 'vscode-languageclient';

let defaultClient: LanguageClient;
let clients: Map<string, LanguageClient> = new Map();

let _sortedWorkspaceFolders: string[];
function sortedWorkspaceFolders(): string[] {
    if (_sortedWorkspaceFolders === void 0) {
        _sortedWorkspaceFolders = Workspace.workspaceFolders.map(folder => {
            let result = folder.uri.toString();
            // Ensure ends with consistent character
            if (result.charAt(result.length - 1) !== '/') {
                result = result + '/';
            }
            return result;
        }).sort(
            (a, b) => {
                return a.length - b.length; //Sort in length order with longest first(?)
            }
            );
    }
    return _sortedWorkspaceFolders;
}
Workspace.onDidChangeWorkspaceFolders(() => _sortedWorkspaceFolders = undefined);

function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
    let sorted = sortedWorkspaceFolders();
    for (let element of sorted) {
        let uri = folder.uri.toString();
        if (uri.charAt(uri.length - 1) !== '/') {
            uri = uri + '/';
        }
        if (uri.startsWith(element)) {
            return Workspace.getWorkspaceFolder(Uri.parse(element));
        }
    }
    return folder;
}

export function activate(context: ExtensionContext) {

    let module = context.asAbsolutePath(path.join('out', 'server', 'index.js'));
    let outputChannel: OutputChannel = Window.createOutputChannel('Minecraft Functions');

    function didOpenTextDocument(document: TextDocument): void {
        // We are only interested in mcfunction files
        if (document.languageId !== 'mcfunction' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) {
            return;
        }

        let uri = document.uri;
        // Untitled files go to a default client.
        if (uri.scheme === 'untitled' && !defaultClient) {
            let debugOptions = { execArgv: ["--nolazy", "--inspect=6010"] };
            let serverOptions = {
                run: { module, transport: TransportKind.ipc },
                debug: { module, transport: TransportKind.ipc, options: debugOptions }
            };
            let clientOptions: LanguageClientOptions = {
                documentSelector: [
                    { scheme: 'untitled', language: 'plaintext' }
                ],
                diagnosticCollectionName: 'mcfunction-lsp',
                outputChannel: outputChannel
            }
            defaultClient = new LanguageClient('mcfunction-lsp', 'Minecraft Function Language Server', serverOptions, clientOptions);
            defaultClient.start();
            return;
        }
        let folder = Workspace.getWorkspaceFolder(uri);
        // Files outside a folder can't be handled. This might depend on the language.
        // Single file languages like JSON might handle files outside the workspace folders.
        if (!folder) {
            return;
        }
        // If we have nested workspace folders we only start a server on the outer most workspace folder.
        folder = getOuterMostWorkspaceFolder(folder);

        if (!clients.has(folder.uri.toString())) {
            let debugOptions = { execArgv: ["--nolazy", `--inspect=${6011 + clients.size}`] };
            let serverOptions = {
                run: { module, transport: TransportKind.ipc },
                debug: { module, transport: TransportKind.ipc, options: debugOptions }
            };
            let clientOptions: LanguageClientOptions = {
                documentSelector: [
                    { scheme: 'file', language: 'mcfunction', pattern: `${folder.uri.fsPath}/**/*` }
                ],
                diagnosticCollectionName: 'mcfunction-lsp',
                workspaceFolder: folder,
                outputChannel: outputChannel
            }
            let client = new LanguageClient('mcfunction-lsp', 'Minecraft Function Language Server', serverOptions, clientOptions);
            client.start();
            clients.set(folder.uri.toString(), client);
        }
    }

    Workspace.onDidOpenTextDocument(didOpenTextDocument);
    Workspace.textDocuments.forEach(didOpenTextDocument);
    Workspace.onDidChangeWorkspaceFolders((event) => {
        for (let folder of event.removed) {
            let client = clients.get(folder.uri.toString());
            if (client) {
                clients.delete(folder.uri.toString());
                client.stop();
            }
        }
    });
}

export function deactivate(): Thenable<void> {
    let promises: Thenable<void>[] = [];
    if (defaultClient) {
        promises.push(defaultClient.stop());
    }
    for (let client of clients.values()) {
        promises.push(client.stop());
    }
    return Promise.all(promises).then(() => undefined);
}
