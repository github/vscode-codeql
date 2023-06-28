import { formatDecimal } from "../../../src/common/number";

describe("Number", () => {
  it("should return a formatted decimal", () => {
    expect(formatDecimal(9)).toBe("9");
    expect(formatDecimal(10_000)).toBe("10,000");
    expect(formatDecimal(100_000_000_000)).toBe("100,000,000,000");
  });
});
