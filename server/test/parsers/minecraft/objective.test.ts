import * as assert from "assert";
import { parser as objectiveArgumentParser } from "../../../parsers/minecraft/objective";
import { StringReader } from "../../../string-reader";

describe("Objective Argument Parser", () => {
    describe("parse()", () => {
        it("should not throw if the input is less than 16 characters long", () => {
            const reader = new StringReader("test_objective");
            assert.doesNotThrow(() => objectiveArgumentParser.parse(reader, null));
        });
        it("should throw if the input is larger than 16 characters", () => {
            const reader = new StringReader("long_objective_16");
            assert.throws(() => objectiveArgumentParser.parse(reader, null));
        });
    });
});
