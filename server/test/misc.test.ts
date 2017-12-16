import * as assert from "assert";
import { platform } from "os";
import { calculateDataFolder } from "../types";

describe("calculateDataFolder()", () => {
    it("should find the datapack folder of a string on linux", function() {
        if (platform() !== "linux") {
            this.skip();
        }
        assert.equal(calculateDataFolder("/home/user/minecraft/datapacks/hello/filename.txt"), "/home/user/minecraft/datapacks/hello/");
    });
    it("should find the datapack folder of a string on windows", function() {
        if (platform() !== "win32") {
            this.skip();
        }
        assert.equal(calculateDataFolder("C:\\Users\\user\\Documents\\minecraft\\datapacks\\hello\\filename.txt"), "C:\\Users\\user\\Documents\\minecraft\\datapacks\\");
    });
    /**
     * The following tests are only supported on Windows Operating Systems, as that is what I use for development
     */
    it("should return the default when there is no datapack folder", function() {
        if (platform() !== "win32") {
            this.skip();
        }
        assert.equal(calculateDataFolder("C:\\Users\\user\\", "C:\\Test\\Default\\"), "C:\\Test\\Default\\");
    });
    it("should not detect a non-datapacks folder", function() {
        if (platform() !== "win32") {
            this.skip();
        }
        assert.equal(calculateDataFolder("C:\\Users\\user\\datapacksyche\\pack\\file.txt", "C:\\Test\\Default\\"), "C:\\Test\\Default\\");
    });
});
