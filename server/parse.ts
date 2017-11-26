import { ServerInformation } from "./types";

export interface LinesToParse {
    uri: string;
    lines: string[];
    numbers: number[];
}
export function parseLines(value: LinesToParse, serverInfo: ServerInformation) {
    value.lines.push();
    for (let index = 0; index < value.numbers.length; index++) {
        const text = value.lines[index];
        const lineNo = value.numbers[index];
        const info = serverInfo.documentsInformation[value.uri].lines[lineNo];

    }
}

function parseCommand() { }
