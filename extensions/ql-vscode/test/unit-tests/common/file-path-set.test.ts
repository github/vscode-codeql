import { FilePathSet } from "../../../src/common/file-path-set";

describe("FilePathSet", () => {
  describe("isEmpty", () => {
    it("should return true only when set is empty", () => {
      const v = new FilePathSet();
      expect(v.isEmpty()).toBe(true);

      v.addPath("/foo");
      expect(v.isEmpty()).toBe(false);

      v.popPath();
      expect(v.isEmpty()).toBe(true);
    });
  });

  describe("addPath / popPath", () => {
    it("should keep all paths when they don't overlap", () => {
      const v = new FilePathSet();
      v.addPath("/foo");
      v.addPath("/bar");
      v.addPath("/baz");
      expect(v.popPath()).toBe("/foo");
      expect(v.popPath()).toBe("/bar");
      expect(v.popPath()).toBe("/baz");
      expect(v.popPath()).toBe(undefined);
    });

    it("should only keep one copy of repeated paths", () => {
      const v = new FilePathSet();
      v.addPath("/foo");
      v.addPath("/foo");
      v.addPath("/foo");
      expect(v.popPath()).toBe("/foo");
      expect(v.popPath()).toBe(undefined);
    });

    it("should adding adding paths that are children of existing paths", () => {
      const v = new FilePathSet();
      v.addPath("/foo");
      v.addPath("/foo/bar");
      v.addPath("/foo/baz");
      expect(v.popPath()).toBe("/foo");
      expect(v.popPath()).toBe(undefined);
    });

    it("should remove existing paths that are children of new paths", () => {
      const v = new FilePathSet();
      v.addPath("/foo");
      v.addPath("/bar/baz");
      v.addPath("/bar/qux");
      v.addPath("/bar");
      expect(v.popPath()).toBe("/foo");
      expect(v.popPath()).toBe("/bar");
      expect(v.popPath()).toBe(undefined);
    });
  });
});
