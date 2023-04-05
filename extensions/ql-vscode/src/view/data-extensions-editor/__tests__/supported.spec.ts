import { calculateSupportedPercentage } from "../supported";

describe("calculateSupportedPercentage", () => {
  it("when there are no external API usages", () => {
    expect(calculateSupportedPercentage([])).toBe(0);
  });

  it("when there are is 1 supported external API usage", () => {
    expect(
      calculateSupportedPercentage([
        {
          supported: true,
        },
      ]),
    ).toBe(100);
  });

  it("when there are is 1 unsupported external API usage", () => {
    expect(
      calculateSupportedPercentage([
        {
          supported: false,
        },
      ]),
    ).toBe(0);
  });

  it("when there are multiple supporte and unsupported external API usage", () => {
    expect(
      calculateSupportedPercentage([
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
