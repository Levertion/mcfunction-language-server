import { format } from "util";

export interface McError {
    description: string;
    computed: string;
    type: string;
    start: number;
    end: number;
}

export abstract class McError implements McError {
    constructor(start: number, end?: number, ...formatting: string[]) {
        this.computed = format(this.description, formatting);
        this.start = start;
        this.end = end + 1 || -1;
    }
}
