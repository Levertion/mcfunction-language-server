/* --------------------------------------------------------------------------------------------
 * Licensed under the MIT License. See LICENSE and ThirdPartyNotices.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';

import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
	// The debug options for the server
	let debugOptions = { execArgv: ["--nolazy", "--debug=6009"] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	}

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		outputChannelName: "Minecraft Function",
		// Register the server for minecraft function documents
		documentSelector: [{ scheme: 'file', language: 'mcfunction' }],
		synchronize: {
			// Synchronize the setting section 'mcfunction' to the server
			configurationSection: "mcfunction",
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.mcfunction')

		}
	}

	// Create the language client and start the client.
	let disposable: any = new LanguageClient('mcfunction', 'Minecraft Function Server', serverOptions, clientOptions, true)
	disposable = disposable.start();
	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);
}
