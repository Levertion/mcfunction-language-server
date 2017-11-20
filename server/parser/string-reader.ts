import { McError } from "./exceptions";

namespace StringReaderExceptions {
    export class ExpectedInt extends McError {
        public type = "parsing.int.expected";
        constructor(start: number) {
            super("An Integer was expected but null was found instead", start, start + 1);
        }
    }
    export class InvalidInt extends McError {
        public type = "parsing.int.invalid";
        constructor(start: number, end: number, recieved: string) {
            super("Invalid integer '%s'", start, end, recieved);
        }
    }

    export class ExpectedDouble extends McError {
        public type = "parsing.double.expected";
        constructor(start: number) {
            super("A double was expected but null was found instead", start, start + 1);
        }
    }
    export class InvalidDouble extends McError {
        public type = "parsing.double.invalid";
        constructor(start: number, end: number, recieved: string) {
            super("Invalid double '%s'", start, end, recieved);
        }
    }
    export class ExpectedStartOfQuote extends McError {
        public type = "parsing.quote.expected.start";
        constructor(start: number) {
            super("Expected quote to start a string", start, start + 1);
        }
    }
    export class ExpectedEndOfQuote extends McError {
        public type = "parsing.quote.expected.end";
        constructor(start: number, end: number) {
            super("Unclosed quoted string", start, end);
        }
    }
    export class InvalidEscape extends McError {
        public type = "parsing.quote.escape";
        constructor(start: number, end: number, character: string) {
            super("Invalid escape sequence '\\%s' in quoted string", start, end, character);
        }
    }
    export class ExpectedBool extends McError {
        public type = "parsing.bool.expected";
        constructor(start: number) {
            super("A boolean value was expected but null was found instead", start);
        }
    }
    export class InvalidBool extends McError {
        public type = "parsing.bool.invalid";
        constructor(start: number, end: number, bool: string) {
            super("Invalid boolean '%s'", start, end, bool);
        }
    }
    export class ExpectedSymbol extends McError {
        public type = "parsing.expected";
        constructor(start: number, end: number, expected: string, recieved: string) {
            super("Expected %s, got %s", start, end, expected, recieved);
        }
    }
}

export class StringReader {
    public static SYNTAX_ESCAPE: string = "\\";
    public static SYNTAX_QUOTE: string = '"';
    /**
     * Is the given number a valid number character.
     */
    private static isAllowedNumber(c: string): boolean {
        return /^[0-9\.-]$/.test(c);
    }
    /**
     * Is the given character allowed in an unquoted string
     */
    private static isAllowedInUnquotedString(c: string) {
        /^(?:[0-9]|[A-Z]|[a-z]|_|-|\.|\+)$/.test(c);
    }
    /**
     * An integer which represents the current position in a string. This is a zero indexed length
     */
    public cursor: number;
    /**
     * The string of this reader. Should not be changed.
     */
    public readonly string: string;
    /**
     * A StringReader. Allows for easy reading of a literal one thing in a (single line) string follows another.
     */
    constructor(input: string | StringReader) {
        if (input instanceof StringReader) {
            this.string = input.string;
            this.cursor = input.cursor;
        } else {
            this.cursor = 0;
            this.string = input as string;
        }
    }
    /**
     * The number of remaining characters until the end of the string.
     */
    public getRemainingLength(): number {
        return this.string.length - this.cursor;
    }
    /**
     * Get the text in the string which has been passed/Already read
     */
    public getRead(): string {
        return this.string.substring(0, this.cursor);
    }
    /**
     * Get the text from the reader which hasn't been read yet.
     */
    public getRemaining(): string {
        return this.string.substring(this.cursor);
    }
    /**
     * Is it safe to read?
     * @param length The number of characters. Can be omitted
     */
    public canRead(length: number = 1) {
        return this.cursor + length <= this.string.length;
    }
    /**
     * Look at a character without moving the cursor.
     * @param offset Where to look relative to the cursor. Can be omitted
     */
    public peek(offset: number = 0): string {
        return this.string.charAt(this.cursor + offset);
    }
    /**
     * Look at the character at the cursor, which is returned, then move the cursor
     */
    public read(): string {
        return this.string.charAt(this.cursor);
    }
    /**
     * Move the cursor one space
     */
    public skip() {
        this.cursor++;
    }
    /**
     * Go past any whitespace from the cursor's character
     */
    public skipWhitespace() {
        while (this.canRead() && /^\s$/.test(this.peek())) {
            this.skip();
        }
    }
    /**
     * Read an integer from the string
     */
    public readInt(): number {
        const start: number = this.cursor;
        while (this.canRead() && StringReader.isAllowedNumber(this.peek())) {
            this.skip();
        }
        const ReadToTest: string = this.string.substring(start, this.cursor);
        if (ReadToTest.length === 0) {
            throw new StringReaderExceptions.ExpectedInt(start);
        }
        try {
            return parseInt(ReadToTest, 10);
        } catch (error) {
            throw new StringReaderExceptions.InvalidInt(start, this.cursor, ReadToTest);
        }
    }
    /**
     * Read float from the string
     */
    public readDouble(): number {
        const start: number = this.cursor;
        while (this.canRead() && StringReader.isAllowedNumber(this.peek())) {
            this.skip();
        }
        const ReadToTest: string = this.string.substring(start, this.cursor);
        if (ReadToTest.length === 0) {
            throw new StringReaderExceptions.ExpectedDouble(start);
        }
        try {
            return parseFloat(ReadToTest);
        } catch (error) {
            throw new StringReaderExceptions.InvalidDouble(start, this.cursor, ReadToTest);
        }
    }
    /**
     * Read a string from the string, which is not surrounded by quotes.
     */
    public readUnquotedString(): string {
        const start: number = this.cursor;
        while (this.canRead && StringReader.isAllowedInUnquotedString(this.peek())) {
            this.skip();
        }
        return this.string.substring(start, this.cursor);
    }
    /**
     * Read from the string, returning a string, which, in the original had been surrounded by quotes
     */
    public readQuotedString(): string {
        const start = this.cursor;
        if (!this.canRead()) {
            return "";
        } else if (this.peek() !== StringReader.SYNTAX_QUOTE) {
            throw new StringReaderExceptions.ExpectedStartOfQuote(this.cursor);
        }
        this.skip();
        let result: string = "";
        let escaped: boolean = false;
        while (this.canRead()) {
            const c: string = this.read();
            if (escaped) {
                if (c === StringReader.SYNTAX_QUOTE || c === StringReader.SYNTAX_ESCAPE) {
                    result += c;
                    escaped = false;
                } else {
                    this.cursor = this.cursor - 1;
                    throw new StringReaderExceptions.InvalidEscape(this.cursor, this.string.length, c);
                }
            } else if (c === StringReader.SYNTAX_ESCAPE) {
                escaped = true;
            } else if (c === StringReader.SYNTAX_QUOTE) {
                return result.toString();
            } else {
                result += c;
            }
        }
        throw new StringReaderExceptions.ExpectedEndOfQuote(start, this.string.length);
    }
    /**
     * Read a string from the string. If it surrounded by quotes, the quotes are ignored
     */
    public readString(): string {
        if (this.canRead() && this.peek() === StringReader.SYNTAX_QUOTE) {
            return this.readString();
        } else {
            return this.readUnquotedString();
        }
    }
    /**
     * Read a boolean value from the string
     */
    public readBoolean(): boolean {
        const start: number = this.cursor;
        const value: string = this.readString();
        if (value.length === 0) {
            throw new StringReaderExceptions.ExpectedBool(this.cursor);
        }
        switch (value) {
            case "true":
                return true;
            case "false":
                return false;
            default:
                throw new StringReaderExceptions.InvalidBool(start, this.cursor, value);
        }
    }
    /**
     * Check if a character follows.
     * @param c The character which should come next
     */
    public expect(c: string) {
        if (!this.canRead() || this.peek() !== c) {
            throw new StringReaderExceptions.ExpectedSymbol(this.cursor, this.cursor, this.peek(), c);
        }
        this.skip();
    }
}
