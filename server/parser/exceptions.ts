import { format } from "util";

export interface McError {
    description: string;
    computed: string;
    type: string;
    start: number;
    end: number;
}

export abstract class McError implements McError {
    constructor(description: string, start: number, end?: number, ...formatting: string[]) {
        this.computed = format(description, ...formatting);
        this.start = start;
        this.end = end;
    }
}
