import * as assert from "assert";
import { parser as NBTParser, parseValue as parseNBTValue } from "../../../parsers/minecraft/nbt";
import { StringReader } from "../../../string-reader";
import { CommandContext } from "../../../types";

describe("NBT Parser", () => {
    describe("parse()", () => {
        describe("just string tags", () => {
            it("should not throw when receiving a valid unquoted string in a compound", () => {
                const reader: StringReader = new StringReader("{foo:bar}");
                assert.doesNotThrow(() => NBTParser.parse(reader, undefined));
            });
            it("should not throw when receiving a valid quoted string in a compound", () => {
                const reader: StringReader = new StringReader("{foo:\"bar baz\"}");
                assert.doesNotThrow(() => NBTParser.parse(reader, undefined));
            });
            it("should return string when parsing", () => {
                const reader: StringReader = new StringReader("\"hello world\"");
                assert.deepEqual(parseNBTValue(reader).type, "string");
            });
        });
        describe("byte", () => {
            it("should return byte when parsing", () => {
                const reader: StringReader = new StringReader("10b");
                assert.deepEqual(parseNBTValue(reader).type, "byte");
            });
        });
        describe("int", () => {
            it("should return int when parsing", () => {
                const reader: StringReader = new StringReader("156");
                assert.deepEqual(parseNBTValue(reader).type, "int");
            });
        });
        describe("long", () => {
            it("should return long when parsing", () => {
                const reader: StringReader = new StringReader("12345l");
                assert.deepEqual(parseNBTValue(reader).type, "long");
            });
        });
        describe("float", () => {
            it("should return float when parsing", () => {
                const reader: StringReader = new StringReader("1f");
                assert.deepEqual(parseNBTValue(reader).type, "float");
            });
        });
        describe("int array", () => {
            it("should return int array when parsing", () => {
                const reader: StringReader = new StringReader("[I;1, 2, 3, 4, 5]");
                assert.deepEqual(parseNBTValue(reader).type, "int_array");
            });
        });
        describe("byte array", () => {
            it("should return byte array when parsing", () => {
                const reader: StringReader = new StringReader("[B;1, 2, 3, 4, 5]");
                assert.deepEqual(parseNBTValue(reader).type, "byte_array");
            });
        });
        describe("long array", () => {
            it("should return long array when parsing", () => {
                const reader: StringReader = new StringReader("[L;1, 2, 3, 4, 5]");
                assert.deepEqual(parseNBTValue(reader).type, "long_array");
            });
        });
        describe("compound", () => {
            it("should return compound when parsing", () => {
                const reader: StringReader = new StringReader("{test: \"hello\"}");
                assert.deepEqual(parseNBTValue(reader).type, "compound");
            });
        });
        describe("list", () => {
            it("should return list when parsing", () => {
                const reader: StringReader = new StringReader("[\"hi\", \"bye\"]");
                assert.deepEqual(parseNBTValue(reader).type, "list");
            });
            it("should throw if the array has different types", () => {
                const reader: StringReader = new StringReader("[\"hi\", 1]");
                assert.throws(() => parseNBTValue(reader));
            });
        });
    });
    describe("getSuggestions()", () => {
        it("should return the correct value when queried using context", () => {
            const context: CommandContext = { datapacksFolder: undefined, executortype: "any", commandInfo: { nbtInfo: { id: "minecraft:area_effect_cloud", type: "entity" } } };
            assert.deepEqual(NBTParser.getSuggestions("{Duration:", null, context).map((v) => v instanceof String ? v : v.value), ["-2147483648", "0", "1", "2147483647"]);
        });
        it("should return correctly with in NBT context", () => {
            const context: CommandContext = { datapacksFolder: undefined, executortype: "any", commandInfo: { nbtInfo: { id: "minecraft:chest", type: "block" } } };
            assert.deepEqual(NBTParser.getSuggestions("{Items:[{id:\"minecraft:iron_sword\",tag:{Damage:", null, context).map((v) => v instanceof String ? v : v.value), ["-32768s", "0s", "1s", "32767s"]);
        });
        it("should return correct suggestion in lists pt 1", () => {
            const context: CommandContext = { datapacksFolder: undefined, executortype: "any", commandInfo: { nbtInfo: { id: "minecraft:chest", type: "block" } } };
            assert.deepEqual(NBTParser.getSuggestions("{Items:", null, context).map((v) => v instanceof String ? v : v.value), ["["]);
        });
        it("should return correct suggestion in lists pt 2", () => {
            const context: CommandContext = { datapacksFolder: undefined, executortype: "any", commandInfo: { nbtInfo: { id: "minecraft:chest", type: "block" } } };
            assert.deepEqual(NBTParser.getSuggestions("{Items:[{}", null, context).map((v) => v instanceof String ? v : v.value), [",", "]"]);
        });
    });
});
