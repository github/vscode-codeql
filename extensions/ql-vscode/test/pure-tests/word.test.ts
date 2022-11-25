import { pluralize } from "../../src/pure/word";

describe("word helpers", () => {
  describe("pluralize", () => {
    it("should return the plural form if the number is 0", () => {
      expect(pluralize(0, "thing", "things")).toBe("0 things");
    });
    it("should return the singular form if the number is 1", () => {
      expect(pluralize(1, "thing", "things")).toBe("1 thing");
    });
    it("should return the plural form if the number is greater than 1", () => {
      expect(pluralize(7, "thing", "things")).toBe("7 things");
    });
    it("should return the empty string if the number is undefined", () => {
      expect(pluralize(undefined, "thing", "things")).toBe("");
    });
  });
});
