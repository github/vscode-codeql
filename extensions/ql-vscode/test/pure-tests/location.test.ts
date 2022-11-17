import { expect } from "chai";
import "mocha";
import {
  tryGetRemoteLocation,
  tryGetResolvableLocation,
} from "../../src/pure/bqrs-utils";

describe("processing string locations", function () {
  it("should detect Windows whole-file locations", function () {
    const loc = "file://C:/path/to/file.ext:0:0:0:0";
    const wholeFileLoc = tryGetResolvableLocation(loc);
    expect(wholeFileLoc).to.eql({ uri: "C:/path/to/file.ext" });
  });
  it("should detect Unix whole-file locations", function () {
    const loc = "file:///path/to/file.ext:0:0:0:0";
    const wholeFileLoc = tryGetResolvableLocation(loc);
    expect(wholeFileLoc).to.eql({ uri: "/path/to/file.ext" });
  });

  it("should detect Unix 5-part locations", function () {
    const loc = "file:///path/to/file.ext:1:2:3:4";
    const wholeFileLoc = tryGetResolvableLocation(loc);
    expect(wholeFileLoc).to.eql({
      uri: "/path/to/file.ext",
      startLine: 1,
      startColumn: 2,
      endLine: 3,
      endColumn: 4,
    });
  });
  it("should ignore other string locations", function () {
    for (const loc of ["file:///path/to/file.ext", "I am not a location"]) {
      const wholeFileLoc = tryGetResolvableLocation(loc);
      expect(wholeFileLoc).to.be.undefined;
    }
  });
});

describe("getting links to remote (GitHub) locations", function () {
  it("should return undefined if resolvableLocation is undefined", function () {
    const loc = "not a location";
    const fileLinkPrefix = "";
    const sourceLocationPrefix = "";

    const link = tryGetRemoteLocation(
      loc,
      fileLinkPrefix,
      sourceLocationPrefix,
    );

    expect(link).to.be.undefined;
  });

  it("should return undefined if resolvableLocation has the wrong format", function () {
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

    expect(link).to.be.undefined;
  });

  it("should return a remote file ref if the sourceLocationPrefix and resolvableLocation match up", function () {
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

    expect(link).to.eql(
      "https://github.com/owner/repo/blob/sha1234/path/to/file.ext#L194-L237",
    );
  });

  it("should return undefined if the sourceLocationPrefix is missing and resolvableLocation doesn't match the default format", function () {
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

    expect(link).to.eql(undefined);
  });

  it("should return a remote file ref if the sourceLocationPrefix is missing, but the resolvableLocation matches the default format", function () {
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

    expect(link).to.eql(
      "https://github.com/owner/repo/blob/sha1234/path/to/file.ext#L194-L237",
    );
  });
});
