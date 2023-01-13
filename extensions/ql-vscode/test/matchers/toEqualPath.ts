import { expect } from "@jest/globals";
import type { MatcherFunction } from "expect";
import { pathsEqual } from "../../src/pure/files";

// eslint-disable-next-line func-style -- We need to have access to this and specify the type of the function
const toEqualPath: MatcherFunction<[expectedPath: unknown]> = function (
  actual,
  expectedPath,
) {
  if (typeof actual !== "string" || typeof expectedPath !== "string") {
    throw new Error("These must be of type string!");
  }

  const pass = pathsEqual(actual, expectedPath, process.platform);
  if (pass) {
    return {
      message: () =>
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        `expected ${this.utils.printReceived(
          actual,
          // eslint-disable-next-line @typescript-eslint/no-invalid-this
        )} to equal path ${this.utils.printExpected(expectedPath)}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        `expected ${this.utils.printReceived(
          actual,
          // eslint-disable-next-line @typescript-eslint/no-invalid-this
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
