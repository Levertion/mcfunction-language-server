import * as assert from "assert";
import { parser as scoreboardSlotArgumentParser } from "../../../parsers/minecraft/scoreboard_slot";
import { StringReader } from "../../../string-reader";
import { NodeProperties } from "../../../types";

describe("Scoreboard Slot Argument Parser", () => {
    const props: NodeProperties = { key: "test", path: ["test"] };
    describe("parse()", () => {
        it("should accept a valid plain scoreboard slot", () => {
            const reader = new StringReader("belowName list sidebar");
            assert.doesNotThrow(() => scoreboardSlotArgumentParser.parse(reader, props));
            reader.skip();
            assert.doesNotThrow(() => scoreboardSlotArgumentParser.parse(reader, props));
            reader.skip();
            assert.doesNotThrow(() => scoreboardSlotArgumentParser.parse(reader, props));
        });
        it("should accept a valid colour sidebar slot", () => {
            const reader = new StringReader("sidebar.team.aqua ");
            assert.doesNotThrow(() => scoreboardSlotArgumentParser.parse(reader, props));
        });
        it("should not accept a reset sidebar slot", () => {
            const reader = new StringReader("sidebar.team.reset");
            assert.throws(() => scoreboardSlotArgumentParser.parse(reader, props));
        });
    });
    describe("getSuggestions()", () => {
        it("should return all options when start is empty", () => {
            assert.deepEqual(scoreboardSlotArgumentParser.getSuggestions("", props), ["belowName", "list", "sidebar", "sidebar.team.black", "sidebar.team.dark_blue", "sidebar.team.dark_green", "sidebar.team.dark_aqua", "sidebar.team.dark_red", "sidebar.team.dark_purple", "sidebar.team.gold", "sidebar.team.gray", "sidebar.team.dark_gray", "sidebar.team.blue", "sidebar.team.green", "sidebar.team.aqua", "sidebar.team.red", "sidebar.team.light_purple", "sidebar.team.yellow", "sidebar.team.white"]);
        });
        it("should return only the matching options when the start is not empty", () => {
            assert.deepEqual(scoreboardSlotArgumentParser.getSuggestions("below", props), ["belowName"]);
        });
        it("should return the option which is the same as start if there is one", () => {
            assert.deepEqual(scoreboardSlotArgumentParser.getSuggestions("belowName", props), ["belowName"]);
        });
    });
});
