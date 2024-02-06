import type { Result } from "sarif";
import { sarifDiff } from "../../../src/compare/sarif-diff";

describe("sarifDiff", () => {
  const result1: Result = {
    message: {
      text: "result1",
    },
  };
  const result2: Result = {
    message: {
      text: "result2",
    },
  };
  const result3: Result = {
    message: {
      text: "result3",
    },
  };

  it("throws an error when the source query has no results", () => {
    expect(() => sarifDiff([], [result1, result2])).toThrow(
      "CodeQL Compare: Source query has no results.",
    );
  });

  it("throws an error when the target query has no results", () => {
    expect(() => sarifDiff([result1, result2], [])).toThrow(
      "CodeQL Compare: Target query has no results.",
    );
  });

  it("throws an error when there is no overlap between the source and target queries", () => {
    expect(() => sarifDiff([result1], [result2])).toThrow(
      "CodeQL Compare: No overlap between the selected queries.",
    );
  });

  it("return an empty comparison when the results are the same", () => {
    expect(sarifDiff([result1, result2], [result1, result2])).toEqual({
      from: [],
      to: [],
    });
  });

  it("returns the added and removed results", () => {
    expect(sarifDiff([result1, result3], [result1, result2])).toEqual({
      from: [result3],
      to: [result2],
    });
  });

  it("does not use reference equality to compare results", () => {
    const result = {
      message: {
        text: "result1",
      },
    };
    expect(sarifDiff([result], [result1])).toEqual({
      from: [],
      to: [],
    });
  });

  it("does not take into account the index of the artifact location", () => {
    const result1: Result = {
      message: {
        text: "result1",
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "file:///path/to/file1",
              uriBaseId: "%SRCROOT%",
              index: 1,
            },
          },
        },
      ],
    };
    const result2: Result = {
      message: {
        text: "result1",
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "file:///path/to/file1",
              uriBaseId: "%SRCROOT%",
              index: 2,
            },
          },
        },
      ],
    };
    expect(sarifDiff([result1], [result2])).toEqual({
      from: [],
      to: [],
    });
  });

  it("takes into account the other properties of the artifact location", () => {
    const result1: Result = {
      message: {
        text: "result1",
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "file:///path/to/file1",
              uriBaseId: "%SRCROOT%",
            },
          },
        },
      ],
    };
    const result2: Result = {
      message: {
        text: "result1",
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "file:///path/to/file2",
              uriBaseId: "%SRCROOT%",
            },
          },
        },
      ],
    };
    expect(sarifDiff([result1], [result1, result2])).toEqual({
      from: [],
      to: [result2],
    });
  });

  it("does not modify the input", () => {
    const result1: Result = {
      message: {
        text: "result1",
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "file:///path/to/file1",
              uriBaseId: "%SRCROOT%",
              index: 1,
            },
          },
        },
      ],
    };
    const result1Copy = JSON.parse(JSON.stringify(result1));
    const result2: Result = {
      message: {
        text: "result1",
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "file:///path/to/file1",
              uriBaseId: "%SRCROOT%",
              index: 2,
            },
          },
        },
      ],
    };
    const result2Copy = JSON.parse(JSON.stringify(result2));
    expect(sarifDiff([result1], [result2])).toEqual({
      from: [],
      to: [],
    });
    expect(result1).toEqual(result1Copy);
    expect(result2).toEqual(result2Copy);
  });
});
