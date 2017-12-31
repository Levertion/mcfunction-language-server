import { Interval, IntervalTree } from "node-interval-tree";
import { CompletionItem, CompletionItemKind, Position, TextDocumentPositionParams } from "vscode-languageserver/lib/main";
import { getParentOfChildren } from "./miscUtils";
import { getParser } from "./parsers/getParser";
import { ArgRange, CommandContext, DocLine, GivenProperties, NodePath, NodeProperties, ServerInformation, SuggestResult } from "./types";

export function getCompletions(params: TextDocumentPositionParams, server: ServerInformation): CompletionItem[] {
    const docInfo = server.documentsInformation[params.textDocument.uri];
    if (!!docInfo) {
        const lineInfo = docInfo.lines[params.position.line];
        if (lineInfo.text !== undefined && !lineInfo.comment) {
            let path: NodePath;
            let start: number;
            let context: CommandContext;
            const tree = !!lineInfo.tree ? lineInfo.tree : buildTree(lineInfo);
            lineInfo.tree = tree;
            const match = tree.search(params.position.character, params.position.character)[0];
            if (!!match) {
                start = match.low;
                tree.remove(match);
                lineInfo.tree = buildTree(lineInfo);
            }
            const last = getLastNode(tree);
            if (!!last) {
                start = start || (last.high + 1);
                path = last.path;
                context = last.context;
            } else {
                start = 0;
                path = [];
                context = docInfo.defaultContext;
            }
            const node = getParentOfChildren(path, server.tree);
            if (node === false) {
                return [];
            }
            const parentNode = node[0];
            const parentPath = node[1];
            if (!!parentNode.children) {
                const suggestions: CompletionItem[] = [];
                for (const childName of Object.keys(parentNode.children)) {
                    const child = parentNode.children[childName];
                    const parser = getParser(child);
                    const contextCopy = Object.assign({}, context);
                    if (!!parser) {
                        const newPath = Array(...parentPath, childName);
                        const props: NodeProperties = Object.assign<GivenProperties, NodeProperties>((child.properties || {}), { key: childName, path: newPath });
                        suggestions.push(...parser.getSuggestions(lineInfo.text.substring(start, params.position.character), props)
                            .map<CompletionItem>((s) => toCompletion(s, start, params.position, parser.kind), contextCopy));
                    }
                }
                return suggestions;
            }
        } else {
            mcfunctionLog("Error: Attempted to get completions during incomplete parsing");
        }
    }
    return []; // Backup
}

function getLastNode<T extends Interval>(tree: IntervalTree<T>): T | void {
    return Array.from(tree.inOrder())[tree.count - 1];
}

export function buildTree(lineInfo: DocLine): IntervalTree<ArgRange> {
    const tree: IntervalTree<ArgRange> = new IntervalTree<ArgRange>();
    for (const arg of lineInfo.nodes) {
        tree.insert(arg);
    }
    return tree;
}

function toCompletion(suggestion: SuggestResult, start: number, position: Position, parserKind?: CompletionItemKind): CompletionItem {
    let kind: CompletionItemKind = parserKind || CompletionItemKind.Keyword;
    if (typeof suggestion === "string") {
        return {
            textEdit: {
                range: { start: { line: position.line, character: start }, end: { line: position.line, character: position.character } },
                newText: suggestion,
            }, label: suggestion, kind,
        };
    } else {
        if (!!suggestion.kind) {
            kind = suggestion.kind;
        }
        return {
            textEdit: {
                range: {
                    start: { line: position.line, character: start + suggestion.start }, end: { line: position.line, character: position.character },
                }, newText: suggestion.value,
            }, label: suggestion.value, kind,
        };
    }

}
