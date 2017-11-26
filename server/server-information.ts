import { TextDocumentContentChangeEvent } from "vscode-languageserver/lib/main";

/**
 * Get which lines have changed based on an event
 * @param change The change event.
 */
export function getChangedLines(change: TextDocumentContentChangeEvent): ChangedLinesResult {
    const result: ChangedLinesResult = { oldLine: 0, newLine: 0, tracker: [] };
    result.oldLine = change.range.end.line;
    result.newLine = change.range.start.line;
    const lines = change.text.split(/\r?\n/g);
    // See https://stackoverflow.com/a/29559488
    result.tracker = Array.from(new Array(lines.length), (_, i) => i + result.newLine);
    return result;
}

interface ChangedLinesResult {
    tracker: number[];
    oldLine: number;
    newLine: number;
}
