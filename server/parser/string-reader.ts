import { StringReaderExceptions } from "./exceptions";

export class StringReader {
    static SYNTAX_ESCAPE: string = '\\';
    static SYNTAX_QUOTE: string = '"';
    /**
     * An integer which represents the current position in a string. This is a zero indexed length
     */
    cursor: number;
    /**
     * The string of this reader. Should not be changed.
     */
    readonly string: string;
    /**
     * A StringReader. Allows for easy reading of a literal one thing in a (single line) string follows another.    
     * @param input The input. If given a StringReader, will copy the StringReader, else creates a new instance from the given string.     
     */
    constructor(input: string | StringReader) {
        if (input instanceof StringReader) {
            this.string = input.string;
            this.cursor = input.cursor;
        }
        else {
            this.cursor = 0;
            this.string = <string>input;
        }
    }
    /**
     * The number of remaining characters until the end of the string.
     */
    getRemainingLength(): number {
        return this.string.length - this.cursor;
    }
    /**
     * Get the text in the string which has been passed/Already read
     */
    getRead(): string {
        return this.string.substring(0, this.cursor);
    }
    /**
     * Get the text from the reader which hasn't been read yet.
     */
    getRemaining(): string {
        return this.string.substring(this.cursor);
    }
    /**
     * Is it safe to read?
     * @param length The number of characters. Can be omitted
     */
    canRead(length: number = 1) {
        return this.cursor + length <= this.string.length;
    }
    /**
     * Look at a character without moving the cursor.
     * @param offset Where to look relative to the cursor. Can be omitted
     */
    peek(offset: number = 0): string {
        return this.string.charAt(this.cursor + offset);
    }
    /**
     * Look at the character at the cursor, which is returned, then move the cursor
     */
    read(): string {
        return this.string.charAt(this.cursor);
    }
    /**
     * Move the cursor one space
     */
    skip() {
        this.cursor++;
    }
    /**
     * Is the given number a valid number character. 
     */
    private static isAllowedNumber(c: string): boolean {
        return /^[0-9\.-]$/.test(c);
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
    readInt(): number {
        let start: number = this.cursor;
        while (this.canRead() && StringReader.isAllowedNumber(this.peek())) {
            this.skip();
        }
        let ReadToTest: string = this.string.substring(start, this.cursor);
        if (ReadToTest.length == 0) {
            throw new StringReaderExceptions.expectedInt(start);
        }
        try {
            var read: number = parseInt(ReadToTest);
        } catch (error) {
            throw new StringReaderExceptions.invalidInt(start, this.cursor, ReadToTest);
        }
        return read;
    }
    /**
     * Read float from the string
     */
    readDouble(): number {
        let start: number = this.cursor;
        while (this.canRead() && StringReader.isAllowedNumber(this.peek())) {
            this.skip();
        }
        let ReadToTest: string = this.string.substring(start, this.cursor);
        if (ReadToTest.length == 0) {
            throw new StringReaderExceptions.expectedInt(start);
        }
        try {
            var read: number = parseFloat(ReadToTest);
        } catch (error) {
            throw new StringReaderExceptions.invalidDouble(start, this.cursor, ReadToTest);
        }
        return read;
    }
    /**
     * Is the given character allowed in an unquoted string
     * @param c The character to test
     */
    private static isAllowedInUnquotedString(c: string) {
        /^(?:[0-9]|[A-Z]|[a-z]|_|-|\.|\+)$/.test(c);
    }
    /**
     * Read a string from the string, which is not surrounded by quotes.
     */
    readUnquotedString(): string {
        let start: number = this.cursor;
        while (this.canRead && StringReader.isAllowedInUnquotedString(this.peek())) {
            this.skip();
        }
        return this.string.substring(start, this.cursor);
    }
    /**
     * Read from the string, returning a string, which, in the original had been surrounded by quotes
     */
    readQuotedString(): string {
        let start = this.cursor
        if (!this.canRead()) {
            return "";
        } else if (this.peek() != StringReader.SYNTAX_QUOTE) {
            throw new StringReaderExceptions.expectedStartOfQuote(this.cursor);
        }
        this.skip();
        let result: string = "";
        let escaped: boolean = false;
        while (this.canRead()) {
            let c: string = this.read();
            if (escaped) {
                if (c == StringReader.SYNTAX_QUOTE || c == StringReader.SYNTAX_ESCAPE) {
                    result += c;
                    escaped = false;
                } else {
                    this.cursor = this.cursor - 1;
                    throw new StringReaderExceptions.invalidEscape(this.cursor, c);
                }
            } else if (c == StringReader.SYNTAX_ESCAPE) {
                escaped = true;
            } else if (c == StringReader.SYNTAX_QUOTE) {
                return result.toString();
            } else {
                result += c;
            }
        }
        throw new StringReaderExceptions.expectedEndOfQuote(start);
    }
    /**
     * Read a string from the string. If it surrounded by quotes, the quotes are ignored
     */
    readString(): string {
        if (this.canRead() && this.peek() == StringReader.SYNTAX_QUOTE) {
            return this.readString();
        } else {
            return this.readUnquotedString();
        }
    }
    /**
     * Read a boolean value from the string
     */
    readBoolean(): boolean {
        let start: number = this.cursor;
        let value: string = this.readString();
        if (value.length == 0) {
            throw new StringReaderExceptions.expectedBool(this.cursor);
        }
        switch (value) {
            case "true":
                return true;
            case "false":
                return false;
            default:
                throw new StringReaderExceptions.invalidBool(start, this.cursor, value);
        }
    }
    /**
     * Check if a character follows.
     * @param c The character which should come next
     */
    expect(c: string) {
        if (!this.canRead() || this.peek() != c) {
            throw new StringReaderExceptions.expectedSymbol(this.cursor, this.cursor, this.peek(), c)
        }
        this.skip();
    }
}
