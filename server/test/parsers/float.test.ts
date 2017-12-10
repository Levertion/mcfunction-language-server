import * as assert from "assert";
import { floatArgumentParser } from "../../parsers/float";
import { StringReader } from "../../string-reader";
import { FunctionDiagnostic, NodeProperties } from "../../types";

describe("Float Argument Parser", () => {
    describe("parse()", () => {
        function validFloatTests(s: string, expectedNum: number) {
            const numEnd = Math.min(s.indexOf(" ") !== -1 ? s.indexOf(" ") : s.length - 1, s.length - 1);
            describe("no constraints", () => {
                const reader = new StringReader(s);
                const properties: NodeProperties = { key: "test", path: [] };
                it("should not throw an error", () => {
                    assert.doesNotThrow(() => floatArgumentParser.parse(reader, properties));
                });
                it("should set the cursor to the last character", () => {
                    assert.equal(reader.cursor, numEnd);
                });
            });
            describe("less than min", () => {
                const reader = new StringReader(s);
                const properties: NodeProperties = { key: "test", path: [], min: expectedNum + 1 };
                let e: FunctionDiagnostic;
                it("should throw an error", () => {
                    assert.throws(() => { floatArgumentParser.parse(reader, properties); }, (error: FunctionDiagnostic) => { e = error; return true; });
                });
                it("should throw an float too low error", () => {
                    assert.equal(e.type, "argument.float.low");
                });
                it("should start the error at the start of the string", () => {
                    assert.equal(e.start, 0);
                });
                it("should end the error at the end of the float", () => {
                    assert.equal(e.end, numEnd);
                });
            });
            describe("more than max", () => {
                const reader = new StringReader(s);
                const properties: NodeProperties = { key: "test", path: [], max: expectedNum - 1 };
                let e: FunctionDiagnostic;
                it("should throw an error", () => {
                    assert.throws(() => { floatArgumentParser.parse(reader, properties); }, (error: FunctionDiagnostic) => { e = error; return true; });
                });
                it("should throw an float too big error", () => {
                    assert.equal(e.type, "argument.float.big");
                });
                it("should start the error at the start of the string", () => {
                    assert.equal(e.start, 0);
                });
                it("should end the error at the end of the float", () => {
                    assert.equal(e.end, numEnd);
                });
            });
        }
        describe("valid integer", () => {
            validFloatTests("1234", 1234);
        });
        describe("valid integer with space", () => {
            validFloatTests("1234 ", 1234);
        });
        describe("valid float with `.`", () => {
            validFloatTests("1234.5678", 1234.5678);
        });
        describe("valid float with `.` and space", () => {
            validFloatTests("1234.5678 ", 1234.5678);
        });
        describe("java max value testing ", () => {
            const reader = new StringReader("1000000000000000");
            const properties: NodeProperties = { key: "test", path: [] };
            it("should throw an float too big error", () => {
                assert.throws(() => {
                    floatArgumentParser.parse(reader, properties);
                }, (error: FunctionDiagnostic) => {
                    if (error.type === "argument.float.big") {
                        return true;
                    }
                    return false;
                });
            });
        });
        describe("java min value testing ", () => {
            const reader = new StringReader("-1000000000000000");
            const properties: NodeProperties = { key: "test", path: [] };
            it("should throw an float too big error", () => {
                assert.throws(() => {
                    floatArgumentParser.parse(reader, properties);
                }, (error: FunctionDiagnostic) => {
                    if (error.type === "argument.float.low") {
                        return true;
                    }
                    return false;
                });
            });
        });
    });
});
