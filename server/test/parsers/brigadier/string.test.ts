import * as assert from "assert";
import { parser as stringArgumentParser } from "../../../parsers/brigadier/string";
import { StringReader } from "../../../string-reader";
import { NodeProperties } from "../../../types";

describe("String Argument Parser", () => {
    describe("parse()", () => {
        describe("Greedy string", () => {
            const properties: NodeProperties = { key: "test", path: [], type: "greedy" };
            it("should read to the end of the string", () => {
                const reader = new StringReader("test space :\"-)(*");
                assert.doesNotThrow(() => stringArgumentParser.parse(reader, properties));
                assert.equal(reader.cursor, 17);
            });
        });
        // These tests are small as the parser is just a wrapper for the stringreader, which has more comprehensive tests
        describe("Phrase String", () => {
            const properties: NodeProperties = { key: "test", path: [], type: "phrase" };
            it("should read an unquoted string section", () => {
                const reader = new StringReader("test space :\"-)(*");
                assert.doesNotThrow(() => stringArgumentParser.parse(reader, properties));
                assert.equal(reader.cursor, 4);
            });
            it("should read a quoted string section", () => {
                const reader = new StringReader("\"quote test\" :\"-)(*");
                assert.doesNotThrow(() => stringArgumentParser.parse(reader, properties));
                assert.equal(reader.cursor, 12);
            });
        });
        describe("Word String", () => {
            const properties: NodeProperties = { key: "test", path: [], type: "word" };
            it("should read only an unquoted string section", () => {
                const reader = new StringReader("test space :\"-)(*");
                assert.doesNotThrow(() => stringArgumentParser.parse(reader, properties));
                assert.equal(reader.cursor, 4);
            });
            it("should not read a quoted string section", () => {
                const reader = new StringReader("\"quote test\" :\"-)(*");
                assert.doesNotThrow(() => stringArgumentParser.parse(reader, properties));
                assert.equal(reader.cursor, 0);
            });
        });
    });
    describe("getSuggestions()", () => {
        it("should not give any suggestions", () => {
            const properties: NodeProperties = { key: "test", path: [], type: "greedy" };
            assert.deepEqual(stringArgumentParser.getSuggestions("false", properties), []);
        });
    });
});
