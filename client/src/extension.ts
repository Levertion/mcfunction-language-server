/*---------------------------------------------------------
 * Originally copied from:
 * https://github.com/Microsoft/vscode-extension-samples/tree/master/lsp-multi-server-sample
 * Origin under the MIT license: Copyright (C) Microsoft Corporation. All rights reserved.
 * This version under the MIT license as in the project root
 *-------------------------------------------------------*/
import * as path from "path";
import {
    ExtensionContext, OutputChannel, TextDocument, Uri, window, workspace, WorkspaceFolder,
} from "vscode";
import {
    LanguageClient, LanguageClientOptions, TransportKind, VersionedTextDocumentIdentifier,
} from "vscode-languageclient";

let defaultClient: LanguageClient;
const clients: Map<string, LanguageClient> = new Map();

let SortedWorkspaceFolders: string[];
function sortedWorkspaceFolders(): string[] {
    if (SortedWorkspaceFolders === void 0) {
        SortedWorkspaceFolders = workspace.workspaceFolders.map((folder) => {
            let result = folder.uri.toString();
            // Ensure ends with consistent character
            if (result.charAt(result.length - 1) !== "/") {
                result = result + "/";
            }
            return result;
        }).sort(
            (a, b) => {
                return a.length - b.length; // Sort in length order with longest first(?)
            },
        );
    }
    return SortedWorkspaceFolders;
}
workspace.onDidChangeWorkspaceFolders(() => SortedWorkspaceFolders = undefined);

function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
    const sorted = sortedWorkspaceFolders();
    for (const element of sorted) {
        let uri = folder.uri.toString();
        if (uri.charAt(uri.length - 1) !== "/") {
            uri = uri + "/";
        }
        if (uri.startsWith(element)) {
            return workspace.getWorkspaceFolder(Uri.parse(element));
        }
    }
    return folder;
}

export function activate(context: ExtensionContext) {

    const module = context.asAbsolutePath(path.join("server", "index.js"));
    const outputChannel: OutputChannel = window.createOutputChannel("Minecraft Functions");

    function didOpenTextDocument(document: TextDocument): void {
        // We are only interested in mcfunction files
        if (document.languageId !== "mcfunction" || (document.uri.scheme !== "file" && document.uri.scheme !== "untitled")) {
            return;
        }

        const uri = document.uri;
        // Untitled files go to a default client.
        if (uri.scheme === "untitled" && !defaultClient) {
            const debugOptions = { execArgv: ["--nolazy", "--inspect=6010"] };
            const serverOptions = {
                run: { module, transport: TransportKind.ipc },
                debug: { module, transport: TransportKind.ipc, options: debugOptions },
            };
            const clientOptions: LanguageClientOptions = {
                documentSelector: [
                    { scheme: "untitled", language: "mcfunction" },
                ],
                diagnosticCollectionName: "mcfunction-lsp",
                outputChannel,
            };
            defaultClient = new LanguageClient("mcfunction-lsp", "Minecraft Function Language Server", serverOptions, clientOptions);
            defaultClient.start();
            defaultClient.onReady().then(() => clientSetup(defaultClient));
            return;
        }
        let folder = workspace.getWorkspaceFolder(uri);
        // Files outside a folder can't be handled easily. This might depend on the language.
        // Single file languages like JSON might handle files outside the workspace folders.
        if (!folder) {
            return;
        }
        // If we have nested workspace folders we only start a server on the outer most workspace folder.
        folder = getOuterMostWorkspaceFolder(folder);

        if (!clients.has(folder.uri.toString())) {
            const debugOptions = { execArgv: ["--nolazy", `--inspect=${6011 + clients.size}`] };
            const serverOptions = {
                run: { module, transport: TransportKind.ipc },
                debug: { module, transport: TransportKind.ipc, options: debugOptions },
            };
            const clientOptions: LanguageClientOptions = {
                documentSelector: [
                    { scheme: "file", language: "mcfunction", pattern: `${folder.uri.fsPath}/**/*` },
                ],
                diagnosticCollectionName: "mcfunction-lsp",
                workspaceFolder: folder,
                outputChannel,
            };
            const client = new LanguageClient("mcfunction-lsp", "Minecraft Function Language Server", serverOptions, clientOptions);
            client.start();
            clients.set(folder.uri.toString(), client);
            client.onReady().then(() => clientSetup(client));
        }
    }

    workspace.onDidOpenTextDocument(didOpenTextDocument);
    workspace.textDocuments.forEach(didOpenTextDocument);
    workspace.onDidChangeWorkspaceFolders((event) => {
        for (const folder of event.removed) {
            const client = clients.get(folder.uri.toString());
            if (client) {
                clients.delete(folder.uri.toString());
                client.stop();
            }
        }
    });
}

function clientSetup(client: LanguageClient) {
    client.onRequest("getDocumentLines", (textDocument: VersionedTextDocumentIdentifier, changedLines: number[]) => {
        for (const doc of workspace.textDocuments) {
            if (textDocument.uri === doc.uri.toString()) {
                if (doc.version === doc.version) {
                    const newlines: string[] = [];
                    for (const change of changedLines) {
                        try {
                            newlines.push(doc.lineAt(change).text);
                        } catch (e) {
                            changedLines.splice(changedLines.indexOf(change));
                            client.error(JSON.stringify(e));
                        }
                    }
                    return { lines: newlines, numbers: changedLines, uri: textDocument.uri };
                } else {
                    return null;
                }
            }
        }
    });
}

export function deactivate(): Thenable<void> {
    const promises: Array<Thenable<void>> = [];
    if (defaultClient) {
        promises.push(defaultClient.stop());
    }
    for (const client of clients.values()) {
        promises.push(client.stop());
    }
    return Promise.all(promises).then(() => undefined);
}
