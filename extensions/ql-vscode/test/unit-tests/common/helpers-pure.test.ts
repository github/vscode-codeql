import { asyncFilter, getErrorMessage } from "../../../src/common/helpers-pure";

describe("helpers-pure", () => {
  it("should filter asynchronously", async () => {
    expect(await asyncFilter([1, 2, 3], (x) => Promise.resolve(x > 2))).toEqual(
      [3],
    );
  });

  it("should throw on error when filtering", async () => {
    const rejects = (x: number) =>
      x === 3 ? Promise.reject(new Error("opps")) : Promise.resolve(true);

    try {
      await asyncFilter([1, 2, 3], rejects);
      throw new Error("Should have thrown");
    } catch (e) {
      expect(getErrorMessage(e)).toBe("opps");
    }
  });
});
