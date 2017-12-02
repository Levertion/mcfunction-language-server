import * as assert from "assert";
import { StringReader } from "../string-reader";
describe.only("string-reader", () => {
    describe("constructor()", () => {
        describe("string input", () => {
            let reader: StringReader;
            before(() => {
                reader = new StringReader("test");
            });
            it("should create a reader with a the given string", () => {
                assert.equal(reader.string, "test");
            });
            it("should create a reader with cursor at the start", () => {
                assert.equal(reader.cursor, 0);
            });
        });
        describe("string reader input", () => {
            describe("cursor at start", () => {
                let reader: StringReader;
                before(() => {
                    const reader1 = new StringReader("test");
                    reader = new StringReader(reader1);
                });
                it("should have the cursor set at the start", () => {
                    assert.equal(reader.cursor, 0);
                });
                it("should have the same string as the passed reader", () => {
                    assert.equal(reader.string, "test");
                });
            });
            describe("cursor at end", () => {
                let reader: StringReader;
                before(() => {
                    const reader1 = new StringReader("test");
                    reader1.cursor = 3;
                    reader = new StringReader(reader1);
                });
                it("should have the cursor set at the end", () => {
                    assert.equal(reader.cursor, 3);
                });
                it("should have the same string as the passed reader", () => {
                    assert.equal(reader.string, "test");
                });
            });
        });
    });
    describe("getRemainingLength()", () => {
        let reader: StringReader;
        before(() => {
            reader = new StringReader("test");
        });
        it("should give the full length of the string when the cursor is at the start", () => {
            assert.equal(reader.getRemainingLength(), 3);
        });
        it("should give the zero when the cursor is at the end", () => {
            reader.cursor = 3;
            assert.equal(reader.getRemainingLength(), 0);
        });
    });
    describe("getRead()", () => {
        let reader: StringReader;
        beforeEach(() => {
            reader = new StringReader("test");
        });
        it("should give nothing when the cursor is at the start", () => {
            assert.equal(reader.getRead(), "");
        });
        // Note that this is because it gives the text which has been read, which doesn't include the character under the cursor.
        it("should give the full string except the last character when the cursor is at the end", () => {
            reader.cursor = 3;
            assert.equal(reader.getRead(), "tes");
        });
    });
    describe("getRemaining()", () => {
        let reader: StringReader;
        beforeEach(() => {
            reader = new StringReader("test");
        });
        it("should give the full text when the cursor is at the start", () => {
            assert.equal(reader.getRemaining(), "test");
        });
        // Note that this is because it gives the text which hasn't been read, which always includes the character under the cursor.
        it("should give the last character if the cursor is at the end", () => {
            reader.cursor = 3;
            assert.equal(reader.getRemaining(), "t");
        });
    });
    describe("canRead()", () => {
        let reader: StringReader;
        beforeEach(() => {
            reader = new StringReader("test");
        });
        describe("without an input", () => {
            // Note that this should technically always be the case
            // since the reader does not support being created with an empty string
            it("should return true when the cursor is at the start", () => {
                assert.equal(reader.canRead(), true);
            });
            it("should return false when the cursor is at the end of the string", () => {
                reader.cursor = 3;
                assert.equal(reader.canRead(), false);
            });
            it("should return true when the cursor is not at the end of the string", () => {
                reader.cursor = 2;
                assert.equal(reader.canRead(), true);
            });
        });
        describe("with input", () => {
            it("should return true with an input where it can read to", () => {
                assert.equal(reader.canRead(2), true);
                assert.equal(reader.canRead(3), true);
                reader.skip();
                assert.equal(reader.canRead(2), true);
            });
            it("should return false with an input where it can read to", () => {
                assert.equal(reader.canRead(4), false);
                reader.skip();
                assert.equal(reader.canRead(3), false);
                reader.skip();
                assert.equal(reader.canRead(2), false);
            });
        });
    });
    describe("peek()", () => {
        let reader: StringReader;
        beforeEach(() => {
            reader = new StringReader("test");
        });
        it("should give the first character at the start", () => {
            assert.equal(reader.peek(), "t");
        });
        it("should give the second character from the second character", () => {
            reader.skip();
            assert.equal(reader.peek(), "e");
        });
        it("should give the last character from the last character", () => {
            reader.cursor = 3;
            assert.equal(reader.peek(), "t");
        });
        it("should give the character that many spaces in front when given an input", () => {
            assert.equal(reader.peek(1), "e");
            assert.equal(reader.peek(2), "s");
            assert.equal(reader.peek(3), "t");
        });
        it("should return an empty string if it is out of range", () => {
            assert.equal(reader.peek(4), "");
        });
    });
    describe("read()", () => {
        let reader: StringReader;
        beforeEach(() => {
            reader = new StringReader("test");
        });
        it("should give the first character at the start", () => {
            assert.equal(reader.read(), "t");
            assert.equal(reader.cursor, 1);
        });
        it("should give the second character from the second character", () => {
            reader.skip();
            assert.equal(reader.read(), "e");
            assert.equal(reader.cursor, 2);
        });
        it("should give the full string during subsequent reads", () => {
            ["t", "e", "s", "t"].forEach((char: string) => {
                assert.equal(reader.read(), char);
            });
        });
        it("should not increase the cursor past the maximum", () => {
            reader.cursor = 3;
            reader.read();
            assert.equal(reader.cursor, 3);
        });
    });
});
