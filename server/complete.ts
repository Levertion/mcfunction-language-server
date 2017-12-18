import isEqual = require("lodash.isequal");
import { IntervalTree } from "node-interval-tree";
import { CompletionItem, CompletionItemKind, TextDocumentPositionParams } from "vscode-languageserver/lib/main";
import { getNodeAlongPath } from "./miscUtils";
import { getParser } from "./parsers/getParsers";
import { literalArgumentParser } from "./parsers/literal";
import { CommandContext, CommandNode, NodePath, NodeProperties, NodeRange, Parser, ServerInformation } from "./types";

export function getCompletions(params: TextDocumentPositionParams, serverInfo: ServerInformation): CompletionItem[] {
    const docInfo = serverInfo.documentsInformation[params.textDocument.uri];
    if (!!docInfo) {
        const lineInfo = docInfo.lines[params.position.line];
        if (lineInfo.text !== undefined) {
            const completions: CompletionItem[] = [];
            let tree: IntervalTree<NodeRange>;
            if (!!lineInfo.tree) {
                tree = lineInfo.tree;
            } else {
                tree = new IntervalTree<NodeRange>();
                for (const node of lineInfo.nodes) {
                    tree.insert(node);
                }
                lineInfo.tree = tree;
            }
            let curTree: CommandNode;
            let context: CommandContext;
            let start = 0;
            let path: NodePath = [];
            if (tree.count > 0) {
                const matches = tree.search(params.position.character, params.position.character);
                if (matches.length > 0) {
                    const match = matches[0];
                    context = match.context; // This is not right? It needs to be the context of the node before to be accurate.
                    // Note that if path is empty, getNodeAlongPath returns the complete tree
                    const shortenedPath = match.path.filter((_, i, s) => i < (s.length - 1));
                    curTree = getNodeAlongPath(shortenedPath, serverInfo.tree);
                    start = match.low;
                } else {
                    const ordered = Array.from(tree.inOrder());
                    const last = ordered[ordered.length - 1];
                    curTree = getNodeAlongPath(last.path, serverInfo.tree);
                    context = last.context;
                    start = last.high + 1;
                    path = last.path;
                }
            } else {
                curTree = serverInfo.tree;
                context = { executortype: "any", fileUri: params.textDocument.uri, server: serverInfo };
            }
            if (!curTree.children && curTree.redirect) {
                curTree = getNodeAlongPath(curTree.redirect, serverInfo.tree);
            }
            if (isEqual(path, ["execute", "run"])) {
                curTree = serverInfo.tree;
            }
            for (const childKey in curTree.children) {
                if (curTree.children.hasOwnProperty(childKey)) {
                    const child = curTree.children[childKey];
                    const childProperties: NodeProperties = (child.properties || {}) as NodeProperties;
                    const newPath = path.slice(); // Clone old to new - https://stackoverflow.com/a/7486130
                    newPath.push(childKey);
                    let parser: Parser;
                    childProperties.key = childKey;
                    childProperties.path = newPath;
                    if (child.type === "literal") {
                        parser = literalArgumentParser;
                    } else if (child.type === "argument") {
                        const tempparser = getParser(child.parser, serverInfo);
                        if (!tempparser) {
                            continue;
                        }
                        parser = tempparser;
                    } else {
                        continue;
                    }
                    const result = parser.getSuggestions(lineInfo.text.substring(start), childProperties, context);
                    completions.push(...result.map<CompletionItem>((suggestion) => {
                        let kind: CompletionItemKind = CompletionItemKind.Keyword;
                        if (!!parser.kind) {
                            kind = parser.kind;
                        }
                        if (typeof suggestion === "string") {
                            return { textEdit: { range: { start: { line: params.position.line, character: start }, end: { line: params.position.line, character: params.position.character } }, newText: suggestion }, label: suggestion, kind };
                        } else {
                            if (!!suggestion.kind) {
                                kind = suggestion.kind;
                            }
                            return { textEdit: { range: { start: { line: params.position.line, character: start + suggestion.start }, end: { line: params.position.line, character: params.position.character } }, newText: suggestion.value }, label: suggestion.value };
                        }
                    }));
                }
            }
            return completions;
        } else {
            serverInfo.logger("Cannot computer completions whilst parsing of the line is occuring!");
        }
    }
    return [];
}
