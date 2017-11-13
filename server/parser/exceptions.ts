import { format } from "util";

export interface mcError {
    description: string
    computed: string
    type: string
    start: number
    end: number
}

export class mcError implements mcError {
    constructor(start: number, end?: number, ...formatting: string[]) {
        this.computed = format(this.description, formatting);
        this.start = start;
        this.end = end + 1 || -1;
    }
}
export namespace StringReaderExceptions {
    export class expectedInt extends mcError {
        type = "parsing.int.expected"
        description = "An Integer was expected but null was found instead"
        constructor(start: number) {
            super(start, start);
        }
    }
    export class invalidInt extends mcError {
        type = "parsing.int.invalid"
        description = "Invalid integer '%s'"
        constructor(start: number, end: number, number: string) {
            super(start, end, number);
        }
    }

    export class expectedDouble extends mcError {
        type = "parsing.double.expected"
        description = "A double was expected but null was found instead"
        constructor(start: number) {
            super(start, start);
        }
    }
    export class invalidDouble extends mcError {
        type = "parsing.double.invalid"
        description = "Invalid double '%s'"
        constructor(start: number, end: number, number: string) {
            super(start, end, number);
        }
    }
    export class expectedStartOfQuote extends mcError {
        type = "parsing.quote.expected.start";
        description = "Expected quote to start a string";
        constructor(start: number) {
            super(start);
        }
    }
    export class expectedEndOfQuote extends mcError {
        type = "parsing.quote.expected.end";
        description = "Unclosed quoted string";
        constructor(start: number) {
            super(start);
        }
    }
    export class invalidEscape extends mcError {
        type = "parsing.quote.escape";
        description = "Invalid escape sequence '\\%s' in quoted string";
        constructor(start: number, character: string) {
            super(start, null, character)
        }
    }
    export class expectedBool extends mcError {
        type = "parsing.bool.expected"
        description = "A boolean value was expected but null was found instead"
        constructor(start: number) {
            super(start);
        }
    }
    export class invalidBool extends mcError {
        type = "parsing.bool.invalid"
        description = "Invalid boolean '%s'"
        constructor(start: number, end: number, bool: string) {
            super(start, end, bool);
        }
    }
    export class expectedSymbol extends mcError {
        type = "parsing.expected"
        description = "Expected %s, got %s"
        constructor(start: number, end: number, expected: string, recieved: string) {
            super(start, end, expected, recieved)
        }
    }
}
