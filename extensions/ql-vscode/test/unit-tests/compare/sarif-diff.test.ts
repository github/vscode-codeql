import type { Result } from "sarif";
import { sarifDiff } from "../../../src/compare/sarif-diff";
import { readJson } from "fs-extra";
import { resolve } from "path";

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

  it("does not take into account the location index when in thread flows or related locations", () => {
    const result1: Result = {
      ruleId: "java/static-initialization-vector",
      ruleIndex: 0,
      rule: {
        id: "java/static-initialization-vector",
        index: 0,
      },
      message: {
        text: "A [static initialization vector](1) should not be used for encryption.",
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "src/java.base/share/classes/sun/security/ssl/SSLCipher.java",
              uriBaseId: "%SRCROOT%",
              index: 126,
            },
            region: {
              startLine: 1272,
              startColumn: 55,
              endColumn: 61,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "9a2a0c085da38206:3",
        primaryLocationStartColumnFingerprint: "38",
      },
      codeFlows: [
        {
          threadFlows: [
            {
              locations: [
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/sun/security/ssl/SSLCipher.java",
                        uriBaseId: "%SRCROOT%",
                        index: 126,
                      },
                      region: {
                        startLine: 1270,
                        startColumn: 50,
                        endColumn: 76,
                      },
                    },
                    message: {
                      text: "new byte[] : byte[]",
                    },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/javax/crypto/spec/IvParameterSpec.java",
                        uriBaseId: "%SRCROOT%",
                        index: 12,
                      },
                      region: {
                        startLine: 52,
                        startColumn: 28,
                        endColumn: 37,
                      },
                    },
                    message: {
                      text: "iv : byte[]",
                    },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/javax/crypto/spec/IvParameterSpec.java",
                        uriBaseId: "%SRCROOT%",
                        index: 12,
                      },
                      region: {
                        startLine: 53,
                        startColumn: 14,
                        endColumn: 16,
                      },
                    },
                    message: {
                      text: "iv : byte[]",
                    },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/javax/crypto/spec/IvParameterSpec.java",
                        uriBaseId: "%SRCROOT%",
                        index: 12,
                      },
                      region: {
                        startLine: 53,
                        startColumn: 9,
                        endColumn: 32,
                      },
                    },
                    message: {
                      text: "this <constr(this)> [post update] : IvParameterSpec",
                    },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/sun/security/ssl/SSLCipher.java",
                        uriBaseId: "%SRCROOT%",
                        index: 126,
                      },
                      region: {
                        startLine: 1270,
                        startColumn: 30,
                        endColumn: 77,
                      },
                    },
                    message: {
                      text: "new IvParameterSpec(...) : IvParameterSpec",
                    },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/sun/security/ssl/SSLCipher.java",
                        uriBaseId: "%SRCROOT%",
                        index: 126,
                      },
                      region: {
                        startLine: 1272,
                        startColumn: 55,
                        endColumn: 61,
                      },
                    },
                    message: {
                      text: "params",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
      relatedLocations: [
        {
          id: 1,
          physicalLocation: {
            artifactLocation: {
              uri: "src/java.base/share/classes/sun/security/ssl/SSLCipher.java",
              uriBaseId: "%SRCROOT%",
              index: 126,
            },
            region: {
              startLine: 1270,
              startColumn: 50,
              endColumn: 76,
            },
          },
          message: {
            text: "static initialization vector",
          },
        },
      ],
    };
    const result2: Result = {
      ruleId: "java/static-initialization-vector",
      ruleIndex: 0,
      rule: {
        id: "java/static-initialization-vector",
        index: 0,
      },
      message: {
        text: "A [static initialization vector](1) should not be used for encryption.",
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "src/java.base/share/classes/sun/security/ssl/SSLCipher.java",
              uriBaseId: "%SRCROOT%",
              index: 141,
            },
            region: {
              startLine: 1272,
              startColumn: 55,
              endColumn: 61,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "9a2a0c085da38206:3",
        primaryLocationStartColumnFingerprint: "38",
      },
      codeFlows: [
        {
          threadFlows: [
            {
              locations: [
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/sun/security/ssl/SSLCipher.java",
                        uriBaseId: "%SRCROOT%",
                        index: 141,
                      },
                      region: {
                        startLine: 1270,
                        startColumn: 50,
                        endColumn: 76,
                      },
                    },
                    message: {
                      text: "new byte[] : byte[]",
                    },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/javax/crypto/spec/IvParameterSpec.java",
                        uriBaseId: "%SRCROOT%",
                        index: 12,
                      },
                      region: {
                        startLine: 52,
                        startColumn: 28,
                        endColumn: 37,
                      },
                    },
                    message: {
                      text: "iv : byte[]",
                    },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/javax/crypto/spec/IvParameterSpec.java",
                        uriBaseId: "%SRCROOT%",
                        index: 12,
                      },
                      region: {
                        startLine: 53,
                        startColumn: 14,
                        endColumn: 16,
                      },
                    },
                    message: {
                      text: "iv : byte[]",
                    },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/javax/crypto/spec/IvParameterSpec.java",
                        uriBaseId: "%SRCROOT%",
                        index: 12,
                      },
                      region: {
                        startLine: 53,
                        startColumn: 9,
                        endColumn: 32,
                      },
                    },
                    message: {
                      text: "this <constr(this)> [post update] : IvParameterSpec",
                    },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/sun/security/ssl/SSLCipher.java",
                        uriBaseId: "%SRCROOT%",
                        index: 141,
                      },
                      region: {
                        startLine: 1270,
                        startColumn: 30,
                        endColumn: 77,
                      },
                    },
                    message: {
                      text: "new IvParameterSpec(...) : IvParameterSpec",
                    },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/java.base/share/classes/sun/security/ssl/SSLCipher.java",
                        uriBaseId: "%SRCROOT%",
                        index: 141,
                      },
                      region: {
                        startLine: 1272,
                        startColumn: 55,
                        endColumn: 61,
                      },
                    },
                    message: {
                      text: "params",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
      relatedLocations: [
        {
          id: 1,
          physicalLocation: {
            artifactLocation: {
              uri: "src/java.base/share/classes/sun/security/ssl/SSLCipher.java",
              uriBaseId: "%SRCROOT%",
              index: 141,
            },
            region: {
              startLine: 1270,
              startColumn: 50,
              endColumn: 76,
            },
          },
          message: {
            text: "static initialization vector",
          },
        },
      ],
    };

    expect(sarifDiff([result1], [result2])).toEqual({
      from: [],
      to: [],
    });
  });

  it("only compares the source and sink of a result", async () => {
    const { result1, result2 } = (await readJson(
      resolve(__dirname, "differentPathsSameSourceSink.json"),
    )) as { result1: Result; result2: Result };

    expect(sarifDiff([result1], [result2])).toEqual({
      from: [],
      to: [],
    });
  });

  it("gives a diff when the source and sink of a result differ", async () => {
    const { result1, result2 } = (await readJson(
      resolve(__dirname, "differentPathsDifferentSourceSink.json"),
    )) as { result1: Result; result2: Result };

    expect(sarifDiff([result1, result2], [result2])).toEqual({
      from: [result1],
      to: [],
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
