import * as assert from "assert";
import { parser as blockArgumentParser } from "../../../parsers/minecraft/block";
import { StringReader } from "../../../string-reader";
import { NodeProperties } from "../../../types";

describe("Block Argument Parser", () => {
    const props: NodeProperties = { key: "test", path: ["test"] };
    describe("Parse()", () => {
        it("should not accept an empty string", () => {
            const reader = new StringReader("");
            assert.throws(() => blockArgumentParser.parse(reader, props));
        });
        it("should not accept an incorrect block", () => {
            const reader = new StringReader("minecraft:nonblock");
            assert.throws(() => blockArgumentParser.parse(reader, props));
        });
        it("should accept a valid block", () => {
            const reader = new StringReader("minecraft:stone");
            assert.doesNotThrow(() => blockArgumentParser.parse(reader, props));
        });
        it("should accept a block without a namespace as having a valid namespace", () => {
            const reader = new StringReader("stone");
            assert.doesNotThrow(() => blockArgumentParser.parse(reader, props));
        });
        it("should accept an empty states set", () => {
            const reader = new StringReader("minecraft:stone[]");
            assert.doesNotThrow(() => blockArgumentParser.parse(reader, props));
        });
        it("should accept a valid blockstate", () => {
            const reader = new StringReader("minecraft:acacia_button[powered=true]");
            assert.doesNotThrow(() => blockArgumentParser.parse(reader, props));
        });
        it("should accept multiple valid blockstates", () => {
            const reader = new StringReader("minecraft:acacia_button[powered=true,face=ceiling]");
            assert.doesNotThrow(() => blockArgumentParser.parse(reader, props));
        });
        it("should reject invalid blockstates", () => {
            const reader = new StringReader("minecraft:acacia_button[powered=true,fake=ceiling]");
            assert.throws(() => blockArgumentParser.parse(reader, props));
        });
        it("should reject invalid values for blockstates", () => {
            const reader = new StringReader("minecraft:acacia_button[powered=true,face=invalid]");
            assert.throws(() => blockArgumentParser.parse(reader, props));
        });
        it("should reject a blockstate without a value", () => {
            const reader = new StringReader("minecraft:acacia_button[powered=true,face]");
            assert.throws(() => blockArgumentParser.parse(reader, props));
            const reader2 = new StringReader("minecraft:acacia_button[powered=true,face=]");
            assert.throws(() => blockArgumentParser.parse(reader2, props));
        });
        it("should reject an unclosed blockstates", () => {
            const reader = new StringReader("minecraft:acacia_button[powered=true,face=ceiling");
            assert.throws(() => blockArgumentParser.parse(reader, props));
        });
        it("should reject an unclosed blockstates after a comma", () => {
            const reader = new StringReader("minecraft:acacia_button[powered=true,face=ceiling,");
            assert.throws(() => blockArgumentParser.parse(reader, props));
        });
        it("should reject a surplus comma before closing", () => {
            const reader = new StringReader("minecraft:acacia_button[powered=true,face=ceiling,]");
            assert.throws(() => blockArgumentParser.parse(reader, props));
        });
    });
    describe("getSuggestions()", () => {
        it("should give results when there are suggestions from an empty start", () => {
            assert.ok(blockArgumentParser.getSuggestions("", props).length > 0);
        });
        it("should give suggestions when there are blocks with the valid start", () => {
            assert.deepEqual(blockArgumentParser.getSuggestions("acacia_bar", props), ["minecraft:acacia_bark"]);
            assert.deepEqual(blockArgumentParser.getSuggestions("minecraft:acacia_bar", props), ["minecraft:acacia_bark"]);
        });
        it("should give valid NBT suggestions", () => {
            assert.deepEqual(blockArgumentParser.getSuggestions("minecraft:chest{", props).map((v) => v instanceof String ? v : v.value), ["CustomName", "Lock", "id", "x", "y", "z", "Items", "LootTable", "LootTableSeed", "}"]);
        });
        it("should give valid NBT suggestions", () => {
            assert.deepEqual(blockArgumentParser.getSuggestions("minecraft:chest{x", props).map((v) => v instanceof String ? v : v.value), ["x", ":"]);
        });
    });
});
