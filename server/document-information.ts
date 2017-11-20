import { Interval, IntervalTree } from "node-interval-tree";
import { Diagnostic, TextDocumentContentChangeEvent } from "vscode-languageserver/lib/main";
/**
 * A description of an area of a node.
 */
export interface NodeRange extends Interval {
    /**
     * The name of the node in the tree.
     */
    key: string;
    /**
     * The path to the node in the command tree.
     * TODO: Actually implement this.
     */
    path?: string[];
}

export interface DocLine {
    issue?: Diagnostic;
    Nodes: IntervalTree<NodeRange>;

}

export interface DocumentInformation {
    lines: DocLine[];
}

interface ChangedLinesResult {
    tracker: number[];
    added: number;
    oldLine: number;
    newLine: number;
}

export function getChangedLines(change: TextDocumentContentChangeEvent, linesToTrack: number[]) {
    const result: ChangedLinesResult = { oldLine: 0, newLine: 0, tracker: [], added: 0 };
    result.oldLine = change.range.end.line;
    result.newLine = change.range.start.line;
    const lines = change.text.split(/\r?\n/g);
    // See https://stackoverflow.com/a/29559488
    result.tracker = linesToTrack.concat(Array.from(new Array(lines.length), (_, i) => i + result.newLine));
    result.added = lines.length;
    return result;
}
