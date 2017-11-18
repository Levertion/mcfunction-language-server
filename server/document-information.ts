import { Interval, IntervalTree } from "node-interval-tree";
import { TextDocumentContentChangeEvent } from "vscode-languageserver/lib/main";
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
     */
    path: string[];
}

export interface DocumentInformation {
    lines: Array<IntervalTree<NodeRange>>;
}

interface ChangedLines {
    oldLine: number;
    newLine: number;
}

interface ChangedLinesResult {
    tracker: number[];
    linesChange: ChangedLines;
}

export function getChangedLines(change: TextDocumentContentChangeEvent, linesToTrack: number[]) {
    const h: ChangedLinesResult = { linesChange: { oldLine: 0, newLine: 0 }, tracker: [] };
    h.linesChange.oldLine = change.range.end.line;
    h.linesChange.newLine = change.range.start.line;
    const lines = change.text.split(/\r?\n/g);
    h.linesChange.newLine += lines.length - 1;
    // See https://stackoverflow.com/a/29559488
    h.tracker = linesToTrack.concat(Array.from(new Array(lines.length - 1), (_, i) => i + h.linesChange.oldLine));
    return h;
}
