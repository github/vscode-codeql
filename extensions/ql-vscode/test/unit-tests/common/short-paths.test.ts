import { platform } from "os";
import type { BaseLogger } from "../../../src/common/logging";
import { expandShortPaths } from "../../../src/common/short-paths";
import { join } from "path";

describe("expandShortPaths", () => {
  let logger: BaseLogger;

  beforeEach(() => {
    logger = {
      log: jest.fn(),
    };
  });

  describe("on POSIX", () => {
    if (platform() === "win32") {
      console.log(`Skipping test on Windows`);
      return;
    }

    it("should return the same path for non-Windows platforms", async () => {
      const path = "/home/user/some~path";
      const result = await expandShortPaths(path, logger);

      expect(logger.log).not.toHaveBeenCalled();
      expect(result).toBe(path);
    });
  });

  describe("on Windows", () => {
    if (platform() !== "win32") {
      console.log(`Skipping test on non-Windows`);
      return;
    }

    it("should return the same path if no short components", async () => {
      const path = "C:\\Program Files\\Some Folder";
      const result = await expandShortPaths(path, logger);

      expect(logger.log).toHaveBeenCalledWith(
        `Expanding short paths in: ${path}`,
      );
      expect(logger.log).toHaveBeenCalledWith(
        "Skipping due to no short components",
      );
      expect(result).toBe(path);
    });

    it("should not attempt to expand long paths with '~' in the name", async () => {
      const testDir = join(__dirname, "../data/short-paths");
      const path = join(testDir, "textfile-with~tilde.txt");
      const result = await expandShortPaths(path, logger);

      expect(logger.log).toHaveBeenCalledWith(
        `Expanding short paths in: ${path}`,
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Expanding short path component: textfile-with~tilde.txt`,
      );
      expect(logger.log).toHaveBeenCalledWith(`Component is not a short name`);
      expect(result).toBe(join(testDir, "textfile-with~tilde.txt"));
    });

    it("should expand a short path", async () => {
      const path = "C:\\PROGRA~1\\Some Folder";
      const result = await expandShortPaths(path, logger);

      expect(logger.log).toHaveBeenCalledWith(
        `Expanding short paths in: ${path}`,
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Expanding short path component: PROGRA~1`,
      );
      expect(result).toBe("C:\\Program Files\\Some Folder");
    });

    it("should expand multiple short paths", async () => {
      const testDir = join(__dirname, "../data/short-paths");
      const path = join(testDir, "FOLDER~1", "TEXTFI~1.TXT");
      const result = await expandShortPaths(path, logger);

      expect(logger.log).toHaveBeenCalledWith(
        `Expanding short paths in: ${path}`,
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Expanding short path component: FOLDER~1`,
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Expanding short path component: TEXTFI~1.TXT`,
      );
      expect(result).toBe(
        join(testDir, "folder with space", ".textfile+extra.characters.txt"),
      );
    });
  });
});
