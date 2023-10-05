import { calculateModeledPercentage } from "../../../../src/model-editor/shared/modeled-percentage";
import { createMethod } from "../../../factories/model-editor/method-factories";

describe("calculateModeledPercentage", () => {
  it("when there are no external API usages", () => {
    expect(calculateModeledPercentage([])).toBe(0);
  });

  it("when there are is 1 modeled external API usage", () => {
    expect(
      calculateModeledPercentage([
        createMethod({
          supported: true,
        }),
      ]),
    ).toBe(100);
  });

  it("when there are is 1 unmodeled external API usage", () => {
    expect(
      calculateModeledPercentage([createMethod({ supported: false })]),
    ).toBe(0);
  });

  it("when there are multiple modeled and unmodeled external API usage", () => {
    expect(
      calculateModeledPercentage([
        createMethod({ supported: false }),
        createMethod({ supported: true }),
        createMethod({ supported: false }),
        createMethod({ supported: false }),
        createMethod({ supported: true }),
        createMethod({ supported: false }),
      ]),
    ).toBeCloseTo(33.33);
  });
});
