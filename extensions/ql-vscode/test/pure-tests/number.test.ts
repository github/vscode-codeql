import { expect } from "chai";
import "mocha";

import { formatDecimal } from "../../src/pure/number";

describe("Number", () => {
  it("should return a formatted decimal", () => {
    expect(formatDecimal(9)).to.eq("9");
    expect(formatDecimal(10_000)).to.eq("10,000");
    expect(formatDecimal(100_000_000_000)).to.eq("100,000,000,000");
  });
});
