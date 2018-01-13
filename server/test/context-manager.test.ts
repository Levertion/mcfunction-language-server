import * as assert from "assert";
import { getContextForPath } from "../context-manager";

describe("misc context manager tests", () => {
    it("should return the correct context when querying a path", () => {
        assert.deepEqual(getContextForPath(["summon", "entity", "pos", "nbt"], {
            datapacksFolder: null,
            executortype: null,
        }, ["summon", "minecraft:area_effect_cloud", "~ ~ ~"]).commandInfo, { nbtInfo: { type: "entity", id: "minecraft:area_effect_cloud" } });
    });
});
