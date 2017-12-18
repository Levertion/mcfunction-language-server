import * as assert from "assert";
import { parser as swizzleArgumentParser } from "../../../parsers/minecraft/swizzle";
import { StringReader } from "../../../string-reader";

describe("Swizzle Argument Parser", () => {
    describe("parse()", () => {
        it("should not throw an error when it reads a valid single swizzle", () => {
            const reader1 = new StringReader("x");
            const reader2 = new StringReader("y");
            const reader3 = new StringReader("z");
            assert.doesNotThrow(() => swizzleArgumentParser.parse(reader1, null));
            assert.doesNotThrow(() => swizzleArgumentParser.parse(reader2, null));
            assert.doesNotThrow(() => swizzleArgumentParser.parse(reader3, null));
        });
        it("should not throw an error when it reads a valid double swizzle", () => {
            const reader1 = new StringReader("xy");
            const reader2 = new StringReader("zy");
            const reader3 = new StringReader("yx");
            assert.doesNotThrow(() => swizzleArgumentParser.parse(reader1, null));
            assert.doesNotThrow(() => swizzleArgumentParser.parse(reader2, null));
            assert.doesNotThrow(() => swizzleArgumentParser.parse(reader3, null));
        });
        it("should not throw an error when it reads a valid tripple swizzle", () => {
            const reader1 = new StringReader("xyz");
            const reader2 = new StringReader("zyx");
            const reader3 = new StringReader("yxz");
            assert.doesNotThrow(() => swizzleArgumentParser.parse(reader1, null));
            assert.doesNotThrow(() => swizzleArgumentParser.parse(reader2, null));
            assert.doesNotThrow(() => swizzleArgumentParser.parse(reader3, null));
        });
        it("should not throw an error when it reads a valid swizzle with a different token after", () => {
            const reader = new StringReader("xyz notaswizzle");
            assert.doesNotThrow(() => swizzleArgumentParser.parse(reader, null));
        });
        it("should throw an error when encountering an invalid character", () => {
            const reader = new StringReader("x!z");
            assert.throws(() => swizzleArgumentParser.parse(reader, null));
        });
        it("should throw if there are more than one of the same axis", () => {
            const reader = new StringReader("xx");
            assert.throws(() => swizzleArgumentParser.parse(reader, null));
        });
    });
    describe("getSuggestions()", () => {
        it("should return a list of swizzles", () => {
            assert.deepEqual(swizzleArgumentParser.getSuggestions("xy", null), ["xy", "xyz"]);
            assert.deepEqual(swizzleArgumentParser.getSuggestions("y", null), ["y", "yx", "yz", "yxz"]);
            assert.deepEqual(swizzleArgumentParser.getSuggestions("zxy", null), ["zxy"]);
        });
    });
});
