import { mcError } from "./exceptions";

export namespace LiteralExceptions {
    export class IncorrectLiteral extends mcError {
        description = "Expected literal %s, got %s";
        type = "argument.literal.incorrect";
        constructor(start: number, expected: string, got: string) {
            super(start, null, expected, got);
        }
    }
}
