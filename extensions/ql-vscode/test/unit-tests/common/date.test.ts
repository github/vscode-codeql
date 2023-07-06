import { formatDate } from "../../../src/common/date";

describe("Date", () => {
  it("should return a formatted date", () => {
    expect(formatDate(new Date(1663326904000))).toBe("Sep 16, 2022, 11:15 AM");
    expect(formatDate(new Date(1631783704000))).toBe("Sep 16, 2021, 9:15 AM");
  });
});
