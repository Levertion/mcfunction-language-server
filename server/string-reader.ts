/**
 * These are implementations of parts of the brigadier command parsing system, for which the source is available as explained in the README at root.  
 * These are recreated to be more closely fitting to the Language server methodology
 */
import { QUOTE, STRINGESCAPE } from "./consts";
import { CommandSyntaxException } from "./types";

const EXCEPTIONS = {
    ExpectedInt: new CommandSyntaxException("An Integer was expected but null was found instead", "parsing.int.expected"),
    InvalidInt: new CommandSyntaxException("Invalid integer '%s'", "parsing.int.invalid"),
    ExpectedFloat: new CommandSyntaxException("A float was expected but null was found instead", "parsing.float.expected"),
    InvalidFloat: new CommandSyntaxException("Invalid float '%s'", "parsing.float.invalid"),
    ExpectedStartOfQuote: new CommandSyntaxException("Expected quote to start a string", "parsing.quote.expected.start"),
    ExpectedEndOfQuote: new CommandSyntaxException("Unclosed quoted string", "parsing.quote.expected.end"),
    InvalidEscape: new CommandSyntaxException("Invalid escape sequence '\\%s' in quoted string", "parsing.quote.escape"),
    ExpectedBool: new CommandSyntaxException("A boolean value was expected but null was found instead", "parsing.bool.expected"),
    InvalidBool: new CommandSyntaxException("Invalid boolean, expected 'true' or 'false', got '%s'", "parsing.bool.invalid"),
    ExpectedSymbol: new CommandSyntaxException("Expected %s, got %s", "parsing.expected"),
};
export class StringReader {
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
     * This is under the assumption that the character under the cursor has not been read.
     */
    public getRemainingLength(): number {
        return this.string.length - this.cursor;
    }
    /**
     * Get the text in the string which has been already read
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
    public canRead(length: number = 1): boolean {
        return (this.cursor + length) <= this.string.length;
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
    public skipWhitespace(): string {
        return this.readWhileRegexp(/\s/);
    }
    /**
     * Read an integer from the string
     */
    public readInt(): number {
        const start: number = this.cursor;
        const readToTest: string = this.readWhileRegexp(/^[\-0-9\.]$/);
        if (readToTest.length === 0) {
            throw EXCEPTIONS.ExpectedInt.create(start, this.string.length);
        }
        // The Java readInt crashes upon a `.`, but the regex includes on in brigadier
        if (readToTest.indexOf(".") !== -1) {
            throw EXCEPTIONS.InvalidInt.create(start, this.cursor, this.string.substring(start, this.cursor));
        }
        try {
            return Number.parseInt(readToTest, 10);
        } catch (error) {
            throw EXCEPTIONS.InvalidInt.create(start, this.cursor, readToTest);
        }
    }
    /**
     * Read float from the string
     */
    public readFloat(): number {
        const start: number = this.cursor;
        const readToTest: string = this.readWhileRegexp(/^[\.\-0-9]$/);
        if (readToTest.length === 0) {
            throw EXCEPTIONS.ExpectedFloat.create(start, this.string.length);
        }
        try {
            return parseFloat(readToTest);
        } catch (error) {
            throw EXCEPTIONS.InvalidFloat.create(start, this.cursor, readToTest);
        }
    }
    /**
     * The cursor ends on the first character after the string allowed characters  
     * Result can have zero length, meaning no matches
     */
    public readUnquotedString(): string {
        return this.readWhileRegexp(/^[0-9A-Za-z_\-.+]$/);
    }
    /**
     * Read from the string, returning a string, which, in the original had been surrounded by quotes
     */
    public readQuotedString(): string {
        const start = this.cursor;
        if (!this.canRead()) {
            return "";
        }
        if (this.peek() !== QUOTE) {
            throw EXCEPTIONS.ExpectedStartOfQuote.create(this.cursor, this.string.length);
        }
        let result: string = "";
        let escaped: boolean = false;
        while (this.canRead()) {
            this.skip();
            const c: string = this.peek();
            if (escaped) {
                if (c === QUOTE || c === STRINGESCAPE) {
                    result += c;
                    escaped = false;
                } else {
                    this.cursor = this.cursor - 1;
                    throw EXCEPTIONS.InvalidEscape.create(this.cursor, this.string.length, c);
                }
            } else if (c === STRINGESCAPE) {
                escaped = true;
            } else if (c === QUOTE) {
                return result;
            } else {
                result += c;
            }
        }
        throw EXCEPTIONS.ExpectedEndOfQuote.create(start, this.string.length);
    }
    /**
     * Read a string from the string. If it surrounded by quotes, the quotes are ignored.  
     * The cursor ends on the last character in the string.
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
            throw EXCEPTIONS.ExpectedBool.create(this.cursor, this.string.length);
        }
        switch (value) {
            case "true":
                return true;
            case "false":
                return false;
            default:
                throw EXCEPTIONS.InvalidBool.create(start, this.cursor, value);
        }
    }
    /**
     * Check if a character follows.
     * @param c The character which should come next
     */
    public expect(c: string) {
        if (this.peek() !== c) {
            throw EXCEPTIONS.ExpectedSymbol.create(this.cursor, this.cursor, this.peek(), c);
        }
        if (this.canRead()) {
            this.skip();
        }
    }
    /**
     * Read while a certain function returns true on each consecutive character starting with the one under the cursor.  
     * In most cases, it is better to use readWhileRegexp.  
     * @param callback The function to use.
     */
    public readWhileFunction(callback: (char: string) => boolean): string {
        const begin = this.cursor;
        while (callback(this.peek())) {
            if (this.canRead()) {
                this.skip();
            } else {
                return this.string.substring(begin);
            }
        }
        return this.string.substring(begin, this.cursor);
    }
    /**
     * Read the string while a certain regular expression matches the character under the cursor.
     * The cursor ends on the first character which doesn't match  
     * @param exp The Regular Expression to test against
     */
    public readWhileRegexp(exp: RegExp): string {
        return this.readWhileFunction((s) => exp.test(s));
    }
    /**
     * Read the string until a certain regular expression matches the character under the cursor.  
     * If no characters match an empty string is returned.  
     * The cursor before the first match of exp
     * @param exp The Regular expression to test against.
     */
    public readUntilRegexp(exp: RegExp) {
        return this.readWhileFunction((s) => !exp.test(s));
    }
    public get cursor(): number {
        return this._cursor;
    }
    public set cursor(v: number) {
        if (v <= this.string.length) {
            this._cursor = v;
        } else {
            // Assummes a string length of greater than 0
            this._cursor = this.string.length;
        }
    }
    public readRemaining(): string {
        const remaining = this.getRemaining();
        this.cursor = this.string.length;
        return remaining;
    }
}
