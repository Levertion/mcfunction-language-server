import * as assert from "assert";
import { integerArgumentParser } from "../../parsers/integer";
import { StringReader } from "../../string-reader";
import { FunctionDiagnostic, NodeProperties } from "../../types";

describe("Integer Argument Parser", () => {
    describe("parse", () => {
        function validIntTests(s: string, expectedNum: number) {
            const intEnd = Math.min(s.indexOf(" ") !== -1 ? s.indexOf(" ") : s.length, s.length) - 1;
            describe("no constraints", () => {
                const reader = new StringReader(s);
                const properties: NodeProperties = { key: "test", path: [] };
                it("should not throw an error", () => {
                    assert.doesNotThrow(() => integerArgumentParser.parse(reader, properties));
                });
                it("should set the cursor to the last character", () => {
                    assert.equal(reader.cursor, intEnd);
                });
            });
            describe("less than min", () => {
                const reader = new StringReader(s);
                const properties: NodeProperties = { key: "test", path: [], min: expectedNum + 1 };
                let e: FunctionDiagnostic;
                it("should throw an error", () => {
                    assert.throws(() => { integerArgumentParser.parse(reader, properties); }, (error: FunctionDiagnostic) => { e = error; return true; });
                });
                it("should throw an integer too low error", () => {
                    assert.equal(e.type, "argument.integer.low");
                });
                it("should start the error at the start of the string", () => {
                    assert.equal(e.start, 0);
                });
                it("should end the error at the end of the integer", () => {
                    assert.equal(e.end, intEnd);
                });
            });
            describe("more than max", () => {
                const reader = new StringReader(s);
                const properties: NodeProperties = { key: "test", path: [], max: expectedNum - 1 };
                let e: FunctionDiagnostic;
                it("should throw an error", () => {
                    assert.throws(() => { integerArgumentParser.parse(reader, properties); }, (error: FunctionDiagnostic) => { e = error; return true; });
                });
                it("should throw an integer too big error", () => {
                    assert.equal(e.type, "argument.integer.big");
                });
                it("should start the error at the start of the string", () => {
                    assert.equal(e.start, 0);
                });
                it("should end the error at the end of the integer", () => {
                    assert.equal(e.end, intEnd);
                });
            });
        }
        describe("valid integer", () => {
            validIntTests("1234", 1234);
        });
        describe("valid integer with space", () => {
            validIntTests("1234 ", 1234);
        });
        describe("java max value testing ", () => {
            const reader = new StringReader("1000000000000000");
            const properties: NodeProperties = { key: "test", path: [] };
            it("should throw an integer too big error", () => {
                assert.throws(() => {
                    integerArgumentParser.parse(reader, properties);
                }, (error: FunctionDiagnostic) => {
                    if (error.type === "argument.integer.big") {
                        return true;
                    }
                    return false;
                });
            });
        });
        describe("java min value testing ", () => {
            const reader = new StringReader("-1000000000000000");
            const properties: NodeProperties = { key: "test", path: [] };
            it("should throw an integer too big error", () => {
                assert.throws(() => {
                    integerArgumentParser.parse(reader, properties);
                }, (error: FunctionDiagnostic) => {
                    if (error.type === "argument.integer.low") {
                        return true;
                    }
                    return false;
                });
            });
        });
    });
});