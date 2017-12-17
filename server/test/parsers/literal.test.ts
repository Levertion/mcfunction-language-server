import * as assert from "assert";
import { literalArgumentParser } from "../../parsers/literal";
import { StringReader } from "../../string-reader";
import { FunctionDiagnostic, NodeProperties } from "../../types";

describe("literalArgumentParser", () => {
    const properties: NodeProperties = { key: "test", path: [] };
    describe("parse()", () => {
        describe("literal correct", () => {
            it("should not throw an error", () => {
                const reader = new StringReader("test");
                assert.doesNotThrow(() => { literalArgumentParser.parse(reader, properties); });
            });
            it("should set the cursor to end of the string when the literal goes to the end of the string", () => {
                const reader = new StringReader("test");
                literalArgumentParser.parse(reader, properties);
                assert.equal(reader.cursor, 3);
            });
            it("should set the cursor to after the string when it doesn't reach the end", () => {
                const reader = new StringReader("test ");
                literalArgumentParser.parse(reader, properties);
                assert.equal(reader.cursor, 4);
            });
        });
        describe("literal not matching", () => {
            it("should throw an error when the first character doesn't mathc", () => {
                const reader = new StringReader("nottest");
                assert.throws(() => { literalArgumentParser.parse(reader, properties); }, (e: FunctionDiagnostic) => {
                    assert.equal(e.start, 0);
                    assert.equal(e.end, 1);
                    return true;
                });
            });
            it("should throw an error when the last character doesn't match", () => {
                const reader = new StringReader("tesnot");
                assert.throws(() => { literalArgumentParser.parse(reader, properties); }, (e: FunctionDiagnostic) => {
                    assert.equal(e.start, 0);
                    assert.equal(e.end, 4);
                    return true;
                });
            });
        });
    });
    describe("getSuggestions()", () => {
        it("should return the literal if it is given a valid start", () => {
            assert.deepEqual(literalArgumentParser.getSuggestions("tes", properties), ["test"]);
            assert.deepEqual(literalArgumentParser.getSuggestions("test", properties), ["test"]);
        });
        it("should give nothing if there is an invalid start", () => {
            assert.deepEqual(literalArgumentParser.getSuggestions("hello", properties), []);
            assert.deepEqual(literalArgumentParser.getSuggestions("nottest", properties), []);
        });
    });
});
