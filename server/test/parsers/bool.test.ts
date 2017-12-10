import * as assert from "assert";
import { boolArgumentParser } from "../../parsers/bool";
import { StringReader } from "../../string-reader";
import { NodeProperties } from "../../types";

describe("Boolean Argument Parser", () => {
    describe("parse()", () => {
        const properties: NodeProperties = { key: "test", path: [] };
        it("should not throw an error when it is reading true", () => {
            const reader = new StringReader("true");
            assert.doesNotThrow(() => boolArgumentParser.parse(reader, properties));
        });
        it("should not throw an error when it is reading false", () => {
            const reader = new StringReader("false");
            assert.doesNotThrow(() => boolArgumentParser.parse(reader, properties));
        });
        it("should throw an error if it is not reading true or false", () => {
            const reader = new StringReader("notbool");
            assert.throws(() => boolArgumentParser.parse(reader, properties));
        });
    });
});
