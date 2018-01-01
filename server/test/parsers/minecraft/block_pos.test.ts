import * as assert from "assert";
import { parser as blockPosParser } from "../../../parsers/minecraft/block_pos";
import { StringReader } from "../../../string-reader";

describe("Block Pos Parser", () => {
    describe("parse()", () => {
        it("should throw if there are local & world coord", () => {
            const reader: StringReader = new StringReader("^1 ~2 ~3");
            assert.throws(() => blockPosParser.parse(reader, undefined));
        });
        it("should not throw if there is a relative coord with no number", () => {
            const reader: StringReader = new StringReader("~ ~ ~");
            assert.doesNotThrow(() => blockPosParser.parse(reader, undefined));
        });
    });
});
