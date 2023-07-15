import {
  tryGetRemoteLocation,
  tryGetResolvableLocation,
} from "../../../src/common/bqrs-utils";

describe("processing string locations", () => {
  it("should detect Windows whole-file locations", () => {
    const loc = "file://C:/path/to/file.ext:0:0:0:0";
    const wholeFileLoc = tryGetResolvableLocation(loc);
    expect(wholeFileLoc).toEqual({ uri: "C:/path/to/file.ext" });
  });
  it("should detect Unix whole-file locations", () => {
    const loc = "file:///path/to/file.ext:0:0:0:0";
    const wholeFileLoc = tryGetResolvableLocation(loc);
    expect(wholeFileLoc).toEqual({ uri: "/path/to/file.ext" });
  });

  it("should detect Unix 5-part locations", () => {
    const loc = "file:///path/to/file.ext:1:2:3:4";
    const wholeFileLoc = tryGetResolvableLocation(loc);
    expect(wholeFileLoc).toEqual({
      uri: "/path/to/file.ext",
      startLine: 1,
      startColumn: 2,
      endLine: 3,
      endColumn: 4,
    });
  });
  it("should ignore other string locations", () => {
    for (const loc of ["file:///path/to/file.ext", "I am not a location"]) {
      const wholeFileLoc = tryGetResolvableLocation(loc);
      expect(wholeFileLoc).toBeUndefined();
    }
  });
});

describe("getting links to remote (GitHub) locations", () => {
  it("should return undefined if resolvableLocation is undefined", () => {
    const loc = "not a location";
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
    const loc = {
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
    const loc = {
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
    const loc = {
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
    const loc = {
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
