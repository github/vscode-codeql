import { mapUrlValue } from "../../../src/common/bqrs-raw-results-mapper";

describe("mapUrlValue", () => {
  it("should detect Windows whole-file locations", () => {
    const loc = "file://C:/path/to/file.ext:0:0:0:0";
    const wholeFileLoc = mapUrlValue(loc);
    expect(wholeFileLoc).toEqual({
      type: "wholeFileLocation",
      uri: "C:/path/to/file.ext",
    });
  });
  it("should detect Unix whole-file locations", () => {
    const loc = "file:///path/to/file.ext:0:0:0:0";
    const wholeFileLoc = mapUrlValue(loc);
    expect(wholeFileLoc).toEqual({
      type: "wholeFileLocation",
      uri: "/path/to/file.ext",
    });
  });

  it("should detect Unix 5-part locations", () => {
    const loc = "file:///path/to/file.ext:1:2:3:4";
    const wholeFileLoc = mapUrlValue(loc);
    expect(wholeFileLoc).toEqual({
      type: "lineColumnLocation",
      uri: "/path/to/file.ext",
      startLine: 1,
      startColumn: 2,
      endLine: 3,
      endColumn: 4,
    });
  });
  it("should set other string locations as strings", () => {
    for (const loc of ["file:///path/to/file.ext", "I am not a location"]) {
      const urlValue = mapUrlValue(loc);
      expect(urlValue).toEqual({
        type: "string",
        value: loc,
      });
    }
  });
});
