import * as assert from "assert";
import { stringArgumentParser } from "../../parsers/string";
import { StringReader } from "../../string-reader";
import { NodeProperties } from "../../types";

describe("String Argument Parser", () => {
    describe("parse()", () => {
        describe("Greedy string", () => {
            const properties: NodeProperties = { key: "test", path: [], type: "greedy" };
            it("should read to the end of the string", () => {
                const reader = new StringReader("test space :\"-)(*");
                assert.doesNotThrow(() => stringArgumentParser.parse(reader, properties));
                assert.equal(reader.cursor, 16);
            });
        });
    });
});
