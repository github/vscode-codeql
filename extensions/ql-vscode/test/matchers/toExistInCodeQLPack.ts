import { expect } from "@jest/globals";
import type { MatcherFunction } from "expect";
import type { QueryPackFS } from "../vscode-tests/utils/bundled-pack-helpers";
import { EOL } from "os";

/**
 * Custom Jest matcher to check if a file exists in a query pack.
 */
// eslint-disable-next-line func-style -- We need to set the type of this function
const toExistInCodeQLPack: MatcherFunction<[packFS: QueryPackFS]> = function (
  actual,
  packFS,
) {
  if (typeof actual !== "string") {
    throw new TypeError(
      `Expected actual value to be a string. Found ${typeof actual}`,
    );
  }

  const pass = packFS.fileExists(actual);
  if (pass) {
    return {
      pass: true,
      message: () => `expected ${actual} not to exist in pack`,
    };
  } else {
    const files = packFS.allFiles();
    const filesString = files.length > 0 ? files.join(EOL) : "<none>";
    return {
      pass: false,
      message: () =>
        `expected ${actual} to exist in pack.\nThe following files were found in the pack:\n${filesString}`,
    };
  }
};

expect.extend({ toExistInCodeQLPack });

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- We need to extend this global declaration
  namespace jest {
    interface AsymmetricMatchers {
      toExistInCodeQLPack(packFS: QueryPackFS): void;
    }

    interface Matchers<R> {
      toExistInCodeQLPack(packFS: QueryPackFS): R;
    }
  }
}
