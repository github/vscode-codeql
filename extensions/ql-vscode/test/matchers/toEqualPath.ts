import { expect } from "@jest/globals";
import type { MatcherFunction } from "expect";
import { pathsEqual } from "../../src/common/files";

// eslint-disable-next-line func-style -- We need to set the type of this function
const toEqualPath: MatcherFunction<[expectedPath: unknown]> = function (
  actual,
  expectedPath,
) {
  if (typeof actual !== "string" || typeof expectedPath !== "string") {
    throw new Error("These must be of type string!");
  }

  const pass = pathsEqual(actual, expectedPath);
  if (pass) {
    return {
      message: () =>
        `expected ${this.utils.printReceived(
          actual,
        )} to equal path ${this.utils.printExpected(expectedPath)}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `expected ${this.utils.printReceived(
          actual,
        )} to equal path ${this.utils.printExpected(expectedPath)}`,
      pass: false,
    };
  }
};

expect.extend({
  toEqualPath,
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- We need to extend this global declaration
  namespace jest {
    interface AsymmetricMatchers {
      toEqualPath(expectedPath: string): void;
    }

    interface Matchers<R> {
      toEqualPath(expectedPath: string): R;
    }
  }
}
