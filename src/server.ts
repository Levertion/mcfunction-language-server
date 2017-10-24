/* --------------------------------------------------------------------------------------------
 * Licensed under the MIT License. See LICENSE and ThirdPartyNotices.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter, createConnection, IConnection, TextDocuments, TextDocument,
	Diagnostic, InitializeResult, TextDocumentPositionParams, CompletionItem,
	//DiagnosticSeverity
} from 'vscode-languageserver';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites. 
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootUri;  //Replaced as rootPath is deprecated
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true
			}
		}
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	validateTextDocument(change.document);
});

// The settings interface describe the server relevant settings part
interface Settings {
	mcfunction: mcfunctionSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface mcfunctionSettings {
	maxNumberOfProblems?: number,
	commandsFilePath?: string
}

interface subValidatorReturn {
	diagnostics: Diagnostic[],
	charIncrease: number,
	sections?: section[]
}

type partType = "literal" | "entities" | "entity" | "players" | "string" | "id" | "x y z" | "x y" | "x z" | "nbt" | "item" | "int" | "bool" | "block" | "x y" | "float" | "json" | "player" | "optional";

interface interpretedCommand {
	as?: string,
	parts: part[]
}

interface part {
	name: string,
	type: partType,
	optionals?: part[]
}

interface section {
	part: part,
	literal: string,
	subSections?: section[]
}
function getPartType(type: string): partType {
	if (["entities", "entity", "players", "string", "id", "x y z", "x y", "x z", "nbt", "item", "int", "bool", "block", "float", "json", "player"].includes(type)) {
		return <partType>type;
	}
	else {
		throw new Error(`|${type}| is not available as a type`);
	}
};

// hold the maxNumberOfProblems setting
let maxNumberOfProblems: number;
//Hold the available commands (in the format as at https://gist.github.com/Dinnerbone/943fbcd763c19be188ed6b72a12d7e65/a7ecc4cfb1d12b66aeb6d4e7f643bec227f0d4f7)
let commands: string[];
let parts: interpretedCommand[] = [];
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	let settings = <Settings>change.settings;
	maxNumberOfProblems = settings.mcfunction.maxNumberOfProblems || 100;
	let fallbackURI = path.join(__dirname, "..", "commands", "minecraft_commands.txt");
	let commandsURI: string = settings.mcfunction.commandsFilePath ? //If the setting is set
		existsSync(path.normalize(settings.mcfunction.commandsFilePath)) ? //If it is a resolving filepath
			settings.mcfunction.commandsFilePath : //URI is the value of the setting
			workspaceRoot ?
				existsSync(path.join(workspaceRoot, settings.mcfunction.commandsFilePath)) ?  //If it a relative URI from the wordspaceRoot
					path.join(workspaceRoot, settings.mcfunction.commandsFilePath) : fallbackURI : fallbackURI : fallbackURI; //It is the relative URI; else useBuiltin to extension 
	commands = existsSync(commandsURI) ? readFileSync(commandsURI).toString().split(/\r?\n/g) : [""];
	for (var s = 0; s < commands.length; s++) {
		connection.console.log(s.toString());
		parts[s] = interpret(commands[s]);
	}
	// Revalidate any open text documents
	documents.all().forEach(validateTextDocument);
});
connection.console.log("Configuration changer installed");

function interpret(command: string): interpretedCommand {
	let intParts: part[] = [];
	let equiv: RegExpExecArray = /-> (.+)/.exec(command) || <RegExpExecArray>[];
	if (equiv.length > 0) {
		command = command.substring(0, command.length - equiv[0].length);
		var as: string = equiv[1];
	}
	while (command.length > 0) {
		let lenChange: number;
		let sections: RegExpExecArray, section: string;
		switch (/[ <\[]/.exec(command)[0]) {
			case "<":
				sections = /(.+?)> ?/.exec(command);
				section = sections[1];
				let split = section.split(": ?");
				intParts.push({ name: split[0].substring(1), type: getPartType(split[1]) });
				lenChange = sections[0].length;
				break;
			case "[":
				sections = /(.+?)] ?/.exec(command);
				section = sections[1];
				section = section.substring(1);
				intParts.push({ type: "optional", name: section, optionals: interpret(section).parts });
				lenChange = sections[0].length;
				break;
			default:
				sections = /(.+)[ $]/.exec(command)
				intParts.push({ type: "literal", name: (sections[1]) });
				lenChange = sections[0].length;
				break;
		}
		command = command.substring(lenChange);
	}
	return { as: as, parts: intParts };
}

// function getMatchingCommands(sections: commandSection[]): commandPart[] { }

function validateCommand(command: string, line: number, startIndex: number, customStart?: section): subValidatorReturn { //line,index are only used to add diagnostics
	connection.console.log(`${command} in validateCommand`); //Temp to appease TS
	let diagnostics: Diagnostic[] = [];
	let charIncrease = 0;
	//Find maincommand
	let sections: section[] = [];
	if (customStart.part) {
		sections[0] = customStart;
	} else {
		connection.console.log(line.toString() + startIndex.toString()); //Temp to appease TS
	}
	return { diagnostics, charIncrease };
}

function validateTextDocument(textDocument: TextDocument): void {
	let diagnostics: Diagnostic[] = [];
	let lines = textDocument.getText().split(/\r?\n/g);
	let problems = 0;
	for (var i = 0; i < 0 && problems < maxNumberOfProblems; i++) {
		let line = lines[i];
		diagnostics.concat(validateCommand(line, i, 0).diagnostics);
	}
	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
	// Monitored files have change in VSCode
});


// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	// The pass parameter contains the position of the text document in 
	// which code complete got requested. For the example we ignore this
	// info and always provide the same completion items.
	return [
		// {
		// 	label: 'TypeScript',
		// 	kind: CompletionItemKind.Text,
		// 	data: 1
		// },
		// {
		// 	label: 'JavaScript',
		// 	kind: CompletionItemKind.,
		// 	data: 2
		// }
	]
});

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	if (item.data === 1) {
		item.detail = 'TypeScript details',
			item.documentation = 'TypeScript documentation'
	} else if (item.data === 2) {
		item.detail = 'JavaScript details',
			item.documentation = 'JavaScript documentation'
	}
	return item;
});

/* 
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
});
 */

// Listen on the connection
connection.listen();
