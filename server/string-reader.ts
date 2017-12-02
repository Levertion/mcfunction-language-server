/**
 * These are implementations of parts of the brigadier command parsing system, for which the source is available as explained in the README at root.  
 * These are recreated to be more closely fitting to the Language server methodology
 */
import { QUOTE, STRINGESCAPE } from "./consts";
import { CommandSyntaxException } from "./types";

export class StringReader {
    private static EXCEPTIONS = {
        ExpectedInt: new CommandSyntaxException("An Integer was expected but null was found instead", "parsing.int.expected"),
        InvalidInt: new CommandSyntaxException("Invalid integer '%s'", "parsing.int.invalid"),
        ExpectedFloat: new CommandSyntaxException("A float was expected but null was found instead", "parsing.float.expected"),
        InvalidFloat: new CommandSyntaxException("Invalid float '%s'", "parsing.float.invalid"),
        ExpectedStartOfQuote: new CommandSyntaxException("Expected quote to start a string", "parsing.quote.expected.start"),
        ExpectedEndOfQuote: new CommandSyntaxException("Unclosed quoted string", "parsing.quote.expected.end"),
        InvalidEscape: new CommandSyntaxException("Invalid escape sequence '\\%s' in quoted string", "parsing.quote.escape"),
        ExpectedBool: new CommandSyntaxException("A boolean value was expected but null was found instead", "parsing.bool.expected"),
        InvalidBool: new CommandSyntaxException("Invalid boolean '%s'", "parsing.bool.invalid"),
        ExpectedSymbol: new CommandSyntaxException("Expected %s, got %s", "parsing.expected"),
    };
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
    public readonly string: string;
    private _cursor: number;
    /**
     * A String Reader. Converts a string into a linear format, which is suitable for Minecraft Commands.  
     * The given string must have a length greater than 0 (unchecked).
     */
    constructor(input: string | StringReader) {
        if (input instanceof StringReader) {
            this.string = input.string;
            this._cursor = input.cursor;
        } else {
            this._cursor = 0;
            this.string = input;
        }
    }
    /**
     * The number of remaining characters until the end of the string.
     */
    public getRemainingLength(): number {
        return this.string.length - 1 - this.cursor;
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
        return this.cursor + length < this.string.length;
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
        return this.string.charAt(this.cursor++);
    }
    /**
     * Move the cursor one space
     */
    public skip() {
        this.cursor++;
    }
    public skipWhitespace() {
        while (/^\s$/.test(this.peek())) {
            if (this.canRead()) {
                this.skip();
            } else { break; }
        }
    }
    /**
     * Read an integer from the string
     */
    public readInt(): number {
        const start: number = this.cursor;
        let read = 0;
        while (StringReader.isAllowedNumber(this.peek())) {
            read++;
            if (this.canRead()) {
                this.skip();
            } else {
                break;
            }
        }
        const readToTest: string = this.string.substr(start, read);
        if (readToTest.length === 0) {
            throw StringReader.EXCEPTIONS.ExpectedInt.create(start, this.string.length);
        }
        try {
            return parseInt(readToTest, 10);
        } catch (error) {
            throw StringReader.EXCEPTIONS.InvalidInt.create(start, this.cursor, readToTest);
        }
    }
    /**
     * Read float from the string
     */
    public readFloat(): number {
        const start: number = this.cursor;
        let read = 0;
        while (StringReader.isAllowedNumber(this.peek())) {
            read++;
            if (this.canRead()) {
                this.skip();
            } else { break; }
        }
        const readToTest: string = this.string.substr(start, read);
        if (readToTest.length === 0) {
            throw StringReader.EXCEPTIONS.ExpectedFloat.create(start, this.string.length);
        }
        try {
            return parseFloat(readToTest);
        } catch (error) {
            throw StringReader.EXCEPTIONS.InvalidFloat.create(start, this.cursor, readToTest);
        }
    }
    /**
     * Read a string from the string, which is not surrounded by quotes.
     */
    public readUnquotedString(): string {
        const start: number = this.cursor;
        while (StringReader.isAllowedInUnquotedString(this.peek())) {
            if (this.canRead()) {
                this.skip();
            } else {
                break;
            }
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
        } else if (this.peek() !== QUOTE) {
            throw StringReader.EXCEPTIONS.ExpectedStartOfQuote.create(this.cursor, this.string.length);
        }
        this.skip();
        let result: string = "";
        let escaped: boolean = false;
        while (true) {
            const c: string = this.peek();
            if (escaped) {
                if (c === QUOTE || c === STRINGESCAPE) {
                    result += c;
                    escaped = false;
                } else {
                    this.cursor = this.cursor - 1;
                    throw StringReader.EXCEPTIONS.InvalidEscape.create(this.cursor, this.string.length, c);
                }
            } else if (c === STRINGESCAPE) {
                escaped = true;
            } else if (c === QUOTE) {
                return result.toString();
            } else {
                result += c;
            }
            if (this.canRead()) {
                this.skip();
            } else {
                break;
            }
        }
        throw StringReader.EXCEPTIONS.ExpectedEndOfQuote.create(start, this.string.length);
    }
    /**
     * Read a string from the string. If it surrounded by quotes, the quotes are ignored
     */
    public readString(): string {
        if (this.canRead() && this.peek() === QUOTE) {
            return this.readQuotedString();
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
            throw StringReader.EXCEPTIONS.ExpectedBool.create(this.cursor, this.string.length);
        }
        switch (value) {
            case "true":
                return true;
            case "false":
                return false;
            default:
                throw StringReader.EXCEPTIONS.InvalidBool.create(start, this.cursor, value);
        }
    }
    /**
     * Check if a character follows.
     * @param c The character which should come next
     */
    public expect(c: string) {
        if (!this.canRead() || this.peek() !== c) {
            throw StringReader.EXCEPTIONS.ExpectedSymbol.create(this.cursor, this.cursor, this.peek(), c);
        }
        this.skip();
    }
    public get cursor(): number {
        return this._cursor;
    }
    public set cursor(v: number) {
        if (v < this.string.length) {
            this._cursor = v;
        } else {
            // Assummes a string length of greater than 0
            this._cursor = this.string.length - 1;
        }
    }
}
