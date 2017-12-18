import * as assert from "assert";
import { parser as operationArgumentParser } from "../../../parsers/minecraft/operation";
import { StringReader } from "../../../string-reader";

describe("Operation argument parser", () => {
    describe("parse()", () => {
        it("should not throw if the operation is valid", () => {
            const reader = new StringReader("/=");
            assert.doesNotThrow(() => operationArgumentParser.parse(reader, null));
            const reader1 = new StringReader("><");
            assert.doesNotThrow(() => operationArgumentParser.parse(reader1, null));
            const reader2 = new StringReader("=");
            assert.doesNotThrow(() => operationArgumentParser.parse(reader2, null));
        });
        it("should throw if it gets an invalid operation", () => {
            const reader = new StringReader("not_operation");
            assert.throws(() => operationArgumentParser.parse(reader, null));
        });
    });
});
