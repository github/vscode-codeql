import type { Location } from "sarif";

import {
  getPathRelativeToSourceLocationPrefix,
  parseSarifLocation,
  parseSarifPlainTextMessage,
  unescapeSarifText,
} from "../../../src/common/sarif-utils";

describe("parsing sarif", () => {
  it("should be able to parse a simple message from the spec", async () => {
    const message = "Tainted data was used. The data came from [here](3).";
    const results = parseSarifPlainTextMessage(message);
    expect(results).toEqual([
      "Tainted data was used. The data came from ",
      { dest: 3, text: "here" },
      ".",
    ]);
  });

  it("should be able to parse a complex message from the spec", async () => {
    const message = "Prohibited term used in [para\\[0\\]\\\\spans\\[2\\]](1).";
    const results = parseSarifPlainTextMessage(message);
    expect(results).toEqual([
      "Prohibited term used in ",
      { dest: 1, text: "para[0]\\spans[2]" },
      ".",
    ]);
  });
  it("should be able to parse a broken complex message from the spec", async () => {
    const message = "Prohibited term used in [para\\[0\\]\\\\spans\\[2\\](1).";
    const results = parseSarifPlainTextMessage(message);
    expect(results).toEqual(["Prohibited term used in [para[0]\\spans[2](1)."]);
  });
  it("should be able to parse a message with extra escaping the spec", async () => {
    const message = "Tainted data was used. The data came from \\[here](3).";
    const results = parseSarifPlainTextMessage(message);
    expect(results).toEqual([
      "Tainted data was used. The data came from [here](3).",
    ]);
  });

  it("should unescape sarif text", () => {
    expect(unescapeSarifText("\\\\ \\\\ \\[ \\[ \\] \\]")).toBe(
      "\\ \\ [ [ ] ]",
    );
    // Also show that unescaped special chars are unchanged...is this correct?
    expect(unescapeSarifText("\\ \\ [ [ ] ]")).toBe("\\ \\ [ [ ] ]");
  });

  it("should normalize source locations", () => {
    expect(getPathRelativeToSourceLocationPrefix("C:\\a\\b", "?x=test")).toBe(
      "file:/C:/a/b/?x=test",
    );
    expect(
      getPathRelativeToSourceLocationPrefix("C:\\a\\b", "%3Fx%3Dtest"),
    ).toBe("file:/C:/a/b/%3Fx%3Dtest");
    expect(
      getPathRelativeToSourceLocationPrefix("C:\\a =\\b c?", "?x=test"),
    ).toBe("file:/C:/a%20%3D/b%20c%3F/?x=test");
    expect(getPathRelativeToSourceLocationPrefix("/a/b/c", "?x=test")).toBe(
      "file:/a/b/c/?x=test",
    );
  });

  describe("parseSarifLocation", () => {
    it('should parse a sarif location with "no location"', () => {
      expect(parseSarifLocation({}, "")).toEqual({
        hint: "no physical location",
      });
      expect(parseSarifLocation({ physicalLocation: {} }, "")).toEqual({
        hint: "no artifact location",
      });
      expect(
        parseSarifLocation({ physicalLocation: { artifactLocation: {} } }, ""),
      ).toEqual({
        hint: "artifact location has no uri",
      });
      expect(
        parseSarifLocation(
          {
            physicalLocation: {
              artifactLocation: {
                uri: "",
                index: 5,
              },
            },
          },
          "",
        ),
      ).toEqual({
        hint: "artifact location has empty uri",
      });
      expect(
        parseSarifLocation(
          {
            physicalLocation: {
              artifactLocation: {
                uri: "file:/",
                index: 5,
              },
            },
          },
          "",
        ),
      ).toEqual({
        hint: "artifact location has empty uri",
      });
    });

    it("should parse a sarif location with no region and no file protocol", () => {
      const location: Location = {
        physicalLocation: {
          artifactLocation: {
            uri: "abc?x=test",
          },
        },
      };
      expect(parseSarifLocation(location, "prefix")).toEqual({
        type: "wholeFileLocation",
        uri: "file:/prefix/abc?x=test",
        userVisibleFile: "abc?x=test",
      });
    });

    it("should parse a sarif location with no region and file protocol", () => {
      const location: Location = {
        physicalLocation: {
          artifactLocation: {
            uri: "file:/abc%3Fx%3Dtest",
          },
        },
      };
      expect(parseSarifLocation(location, "prefix")).toEqual({
        type: "wholeFileLocation",
        uri: "file:/abc%3Fx%3Dtest",
        userVisibleFile: "/abc?x=test",
      });
    });

    it("should parse a sarif location with a region and file protocol", () => {
      const location: Location = {
        physicalLocation: {
          artifactLocation: {
            uri: "file:abc%3Fx%3Dtest",
          },
          region: {
            startLine: 1,
            startColumn: 2,
            endLine: 3,
            endColumn: 4,
          },
        },
      };
      expect(parseSarifLocation(location, "prefix")).toEqual({
        type: "lineColumnLocation",
        uri: "file:abc%3Fx%3Dtest",
        userVisibleFile: "abc?x=test",
        startLine: 1,
        startColumn: 2,
        endLine: 3,
        endColumn: 3,
      });
    });
  });
});
