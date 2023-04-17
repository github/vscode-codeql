import { calculateModelledPercentage } from "../modelled";

describe("calculateModelledPercentage", () => {
  it("when there are no external API usages", () => {
    expect(calculateModelledPercentage([])).toBe(0);
  });

  it("when there are is 1 modelled external API usage", () => {
    expect(
      calculateModelledPercentage([
        {
          supported: true,
        },
      ]),
    ).toBe(100);
  });

  it("when there are is 1 unmodelled external API usage", () => {
    expect(
      calculateModelledPercentage([
        {
          supported: false,
        },
      ]),
    ).toBe(0);
  });

  it("when there are multiple modelled and unmodelled external API usage", () => {
    expect(
      calculateModelledPercentage([
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
