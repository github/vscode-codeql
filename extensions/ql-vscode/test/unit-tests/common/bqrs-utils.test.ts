import { tryGetRemoteLocation } from "../../../src/common/bqrs-utils";

describe(tryGetRemoteLocation.name, () => {
  it.each([
    [undefined, undefined],
    [
      "https://source.example.com/org/repo/blob/abc123",
      "https://source.example.com/org/repo/blob/abc123/src/query.ts",
    ],
  ])(
    "only links raw results when a repository URL is available: %s",
    (prefix, expected) => {
      expect(
        tryGetRemoteLocation(
          { type: "wholeFileLocation", uri: "file:/sources/src/query.ts" },
          prefix,
          "/sources",
        ),
      ).toBe(expected);
    },
  );
});
