import { expect } from "@jest/globals";
import type { ExpectationResult } from "expect";
import type { QueryPackFS } from "../vscode-tests/utils/bundled-pack-helpers";
import { EOL } from "os";

/**
 * Custom Jest matcher to check if a file exists in a query pack.
 */
function toExistInPack(
  this: jest.MatcherContext,
  actual: unknown,
  packFS: QueryPackFS,
): ExpectationResult {
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
}

expect.extend({ toExistInPack });

declare module "expect" {
  interface Matchers<R> {
    toExistInCodeQLPack(packFS: QueryPackFS): R;
  }
}
