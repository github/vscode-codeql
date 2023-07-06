import { calculateModeledPercentage } from "../../../../src/data-extensions-editor/shared/modeled-percentage";

describe("calculateModeledPercentage", () => {
  it("when there are no external API usages", () => {
    expect(calculateModeledPercentage([])).toBe(0);
  });

  it("when there are is 1 modeled external API usage", () => {
    expect(
      calculateModeledPercentage([
        {
          supported: true,
        },
      ]),
    ).toBe(100);
  });

  it("when there are is 1 unmodeled external API usage", () => {
    expect(
      calculateModeledPercentage([
        {
          supported: false,
        },
      ]),
    ).toBe(0);
  });

  it("when there are multiple modeled and unmodeled external API usage", () => {
    expect(
      calculateModeledPercentage([
        {
          supported: false,
        },
        {
          supported: true,
        },
        {
          supported: false,
        },
        {
          supported: false,
        },
        {
          supported: true,
        },
        {
          supported: false,
        },
      ]),
    ).toBeCloseTo(33.33);
  });
});
