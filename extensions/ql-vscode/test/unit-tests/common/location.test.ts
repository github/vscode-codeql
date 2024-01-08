import { tryGetRemoteLocation } from "../../../src/common/bqrs-utils";
import type {
  UrlValue,
  UrlValueResolvable,
} from "../../../src/common/raw-result-types";

describe("tryGetRemoteLocation", () => {
  it("should return undefined if resolvableLocation is undefined", () => {
    const loc = undefined;
    const fileLinkPrefix = "";
    const sourceLocationPrefix = "";

    const link = tryGetRemoteLocation(
      loc,
      fileLinkPrefix,
      sourceLocationPrefix,
    );

    expect(link).toBeUndefined();
  });

  it("should return undefined if resolvableLocation is string", () => {
    const loc: UrlValue = {
      type: "string",
      value: "not a location",
    };
    const fileLinkPrefix = "";
    const sourceLocationPrefix = "";

    const link = tryGetRemoteLocation(
      loc,
      fileLinkPrefix,
      sourceLocationPrefix,
    );

    expect(link).toBeUndefined();
  });

  it("should return undefined if resolvableLocation has the wrong format", () => {
    const loc: UrlValueResolvable = {
      type: "lineColumnLocation",
      uri: "file:/path/to/file.ext",
      startLine: 194,
      startColumn: 18,
      endLine: 237,
      endColumn: 1,
    };
    const fileLinkPrefix = "";
    const sourceLocationPrefix = "/home/foo/bar";

    const link = tryGetRemoteLocation(
      loc,
      fileLinkPrefix,
      sourceLocationPrefix,
    );

    expect(link).toBeUndefined();
  });

  it("should return a remote file ref if the sourceLocationPrefix and resolvableLocation match up", () => {
    const loc: UrlValueResolvable = {
      type: "lineColumnLocation",
      uri: "file:/home/foo/bar/path/to/file.ext",
      startLine: 194,
      startColumn: 18,
      endLine: 237,
      endColumn: 1,
    };
    const fileLinkPrefix = "https://github.com/owner/repo/blob/sha1234";
    const sourceLocationPrefix = "/home/foo/bar";

    const link = tryGetRemoteLocation(
      loc,
      fileLinkPrefix,
      sourceLocationPrefix,
    );

    expect(link).toEqual(
      "https://github.com/owner/repo/blob/sha1234/path/to/file.ext#L194C18-L237C1",
    );
  });

  it("should return undefined if the sourceLocationPrefix is missing and resolvableLocation doesn't match the default format", () => {
    const loc: UrlValueResolvable = {
      type: "lineColumnLocation",
      uri: "file:/home/foo/bar/path/to/file.ext",
      startLine: 194,
      startColumn: 18,
      endLine: 237,
      endColumn: 1,
    };
    const fileLinkPrefix = "https://github.com/owner/repo/blob/sha1234";
    const sourceLocationPrefix = "";

    const link = tryGetRemoteLocation(
      loc,
      fileLinkPrefix,
      sourceLocationPrefix,
    );

    expect(link).toBeUndefined();
  });

  it("should return a remote file ref if the sourceLocationPrefix is missing, but the resolvableLocation matches the default format", () => {
    const loc: UrlValueResolvable = {
      type: "lineColumnLocation",
      uri: "file:/home/runner/work/foo/bar/path/to/file.ext",
      startLine: 194,
      startColumn: 18,
      endLine: 237,
      endColumn: 1,
    };
    const fileLinkPrefix = "https://github.com/owner/repo/blob/sha1234";
    const sourceLocationPrefix = "";

    const link = tryGetRemoteLocation(
      loc,
      fileLinkPrefix,
      sourceLocationPrefix,
    );

    expect(link).toEqual(
      "https://github.com/owner/repo/blob/sha1234/path/to/file.ext#L194C18-L237C1",
    );
  });
});
