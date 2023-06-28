import { findDuplicateStrings } from "../../src/common/text-utils";

describe("findDuplicateStrings", () => {
  it("should find duplicates strings in an array of strings", () => {
    const strings = ["a", "b", "c", "a", "aa", "bb"];
    const duplicates = findDuplicateStrings(strings);
    expect(duplicates).toEqual(["a"]);
  });

  it("should not find duplicates strings if there aren't any", () => {
    const strings = ["a", "b", "c", "aa", "bb"];
    const duplicates = findDuplicateStrings(strings);
    expect(duplicates).toEqual([]);
  });
});
