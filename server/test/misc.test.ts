import * as assert from "assert";
import { platform } from "os";
import { calculateDataFolder, getNodeAlongPath, getParentOfChildren } from "../miscUtils";

describe("calculateDataFolder()", () => {
    it("should find the datapack folder of a string on linux", function () {
        if (platform() !== "linux") {
            this.skip();
        }
        assert.equal(calculateDataFolder("/home/user/minecraft/datapacks/hello/filename.txt"), "/home/user/minecraft/datapacks/");
    });
    it("should find the datapack folder of a string on windows", function () {
        if (platform() !== "win32") {
            this.skip();
        }
        assert.equal(calculateDataFolder("C:\\Users\\user\\Documents\\minecraft\\datapacks\\hello\\filename.txt"), "C:\\Users\\user\\Documents\\minecraft\\datapacks\\");
    });
    /**
     * The following tests are only supported on Windows Operating Systems, as that is what I use for development
     */
    it("should return the default when there is no datapack folder", function () {
        if (platform() !== "win32") {
            this.skip();
        }
        assert.equal(calculateDataFolder("C:\\Users\\user\\", "C:\\Test\\Default\\"), "C:\\Test\\Default\\");
    });
    it("should not detect a non-datapacks folder", function () {
        if (platform() !== "win32") {
            this.skip();
        }
        assert.equal(calculateDataFolder("C:\\Users\\user\\datapacksyche\\pack\\file.txt", "C:\\Test\\Default\\"), "C:\\Test\\Default\\");
    });
});

describe("getNodeAlongPath()", () => {
    it("should find the node along a path", () => {
        assert.deepEqual(getNodeAlongPath(["j", "g"], { type: "root", children: { j: { type: "root", children: { g: { type: "argument" } } } } }), { type: "argument" });
    });
    it("should throw an error when there is an incorrect path", () => {
        assert.throws(() => getNodeAlongPath(["j", "invalid"], { type: "root", children: { j: { type: "root" } } }));
    });
});

describe("getParentOfChildren", () => {
    it("should give the node when given a node with children", () => {
        assert.deepEqual(getParentOfChildren([], { children: {}, type: "root" }), [{ children: {}, type: "root" }, []]);
    });
    it("should give the result of the redirect if there is one, given no children", () => {
        assert.deepEqual(getParentOfChildren(["test2"], { children: { test1: { type: "literal" }, test2: { type: "literal", redirect: ["test1"] } }, type: "root" }), [{ type: "literal" }, ["test1"]]);
    });
    it("should give the root if the path is 'execute run' (to workaround it not being given)", () => {
        assert.deepEqual(getParentOfChildren(["execute", "run"], { children: { execute: { type: "literal", children: { run: { type: "literal" } } } }, type: "root" }),
            [{ children: { execute: { type: "literal", children: { run: { type: "literal" } } } }, type: "root" }, []]);
    });
});
