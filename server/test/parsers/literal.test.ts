import * as assert from "assert";
import { StringReader } from "../../brigadier-implementations";
import { literalArgumentParser } from "../../parsers/literal";
import { FunctionDiagnostic, NodeProperties } from "../../types";

describe("Literal Arguemnt Parser", () => {
    describe("parse", () => {
        const properties: NodeProperties = { key: "test", path: [] };
        describe("matching string", () => {
            describe("no space following literal", () => {
                const reader = new StringReader("test");
                it("should not fail", () => {
                    assert.doesNotThrow(() => { literalArgumentParser.parse(reader, properties); });
                });
                it("should set the cursor to end of literal", () => {
                    assert.equal(reader.cursor, 3);
                });
            });
        });
        describe("space following literal", () => {
            const reader = new StringReader("test ");
            it("should not fail", () => {
                assert.doesNotThrow(() => { literalArgumentParser.parse(reader, properties); });
            });
            it("should set the cursor to end of literal", () => {
                assert.equal(reader.cursor, 3);
            });
        });
        describe("extra characters after literal", () => {
            const reader: StringReader = new StringReader("testextra");
            let e: FunctionDiagnostic;
            it("should throw an error", () => {
                assert.throws(() => { literalArgumentParser.parse(reader, properties); },
                    (error: FunctionDiagnostic) => { e = error; return true; });
            });
            it("should throw a missing space error", () => {
                assert.equal(e.type, "argument.literal.missingspace");
            });
            it("should throw an error starting at first wrong character", () => {
                assert.equal(e.start, 4);
            });
            it("should throw an error starting at first wrong character", () => {
                assert.equal(e.start, 4);
            });
        });
        describe("doesn't match literal from start", () => {
            const reader: StringReader = new StringReader("nottest");
            let e: FunctionDiagnostic;
            it("should throw an error", () => {
                assert.throws(() => { literalArgumentParser.parse(reader, properties); },
                    (error: FunctionDiagnostic) => { e = error; return true; });
            });
            it("should throw an incorrect literal error", () => {
                assert.equal(e.type, "argument.literal.incorrect");
            });
            it("should throw an error starting from the first character", () => {
                assert.equal(e.start, 0);
            });
            it("should throw an error ending on the first character", () => {
                assert.equal(e.end, 1);
            });
        });
        describe("doesn't match literal within the string", () => {
            const reader: StringReader = new StringReader("tett");
            let e: FunctionDiagnostic;
            it("should throw an error", () => {
                assert.throws(() => { literalArgumentParser.parse(reader, properties); },
                    (error: FunctionDiagnostic) => { e = error; return true; });
            });
            it("should throw an incorrect literal error", () => {
                assert.equal(e.type, "argument.literal.incorrect");
            });
            it("should throw an error starting from the start", () => {
                assert.equal(e.start, 0);
            });
            it("should throw an error ending after the wrong character", () => {
                assert.equal(e.end, 3);
            });
        });
    });
});
