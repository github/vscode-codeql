import type {
  Log,
  PhysicalLocation,
  ReportingDescriptor,
  Result,
  Run,
} from "sarif";
import {
  extractAnalysisAlerts,
  tryGetFilePath,
  tryGetRule,
  tryGetSeverity,
} from "../../src/variant-analysis/sarif-processing";
import type {
  AnalysisMessage,
  AnalysisMessageLocationToken,
} from "../../src/variant-analysis/shared/analysis-result";

describe("SARIF processing", () => {
  describe("tryGetRule", () => {
    describe("Using the tool driver", () => {
      it("should return undefined if no rule has been set on the result", () => {
        const result = {
          message: "msg",
          // Rule is missing here.
        } as Result;

        const sarifRun = {
          results: [result],
        } as Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).toBeUndefined();
      });

      it("should return undefined if rule missing from tool driver", () => {
        const result = {
          message: "msg",
          rule: {
            id: "NonExistentRule",
          },
        } as Result;

        const sarifRun = {
          results: [result],
          tool: {
            driver: {
              rules: [
                // No rule with id 'NonExistentRule' is set here.
                {
                  id: "A",
                },
                {
                  id: "B",
                },
              ],
            },
          },
        } as Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).toBeUndefined();
      });

      it("should return rule if it has been set on the tool driver", () => {
        const result = {
          message: "msg",
          rule: {
            id: "B",
          },
        } as Result;

        const sarifRun = {
          results: [result],
          tool: {
            driver: {
              rules: [
                {
                  id: "A",
                },
                result.rule,
              ],
            },
          },
        } as Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).toBeTruthy();
        expect(rule!.id).toBe(result!.rule!.id);
      });
    });

    describe("Using the tool extensions", () => {
      it("should return undefined if rule index not set", () => {
        const result = {
          message: "msg",
          rule: {
            // The rule index should be set here.
            toolComponent: {
              index: 1,
            },
          },
        } as Result;

        const sarifRun = {
          results: [result],
          tool: {
            extensions: [
              {
                name: "foo",
                rules: [
                  {
                    id: "A",
                  },
                  {
                    id: "B",
                  },
                ],
              },
              {
                name: "bar",
                rules: [
                  {
                    id: "C",
                  },
                  {
                    id: "D",
                  },
                ],
              },
            ],
          },
        } as Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).toBeUndefined();
      });

      it("should return undefined if tool component index not set", () => {
        const result = {
          message: "msg",
          rule: {
            index: 1,
            toolComponent: {
              // The tool component index should be set here.
            },
          },
        } as Result;

        const sarifRun = {
          results: [result],
          tool: {
            extensions: [
              {
                name: "foo",
                rules: [
                  {
                    id: "A",
                  },
                  {
                    id: "B",
                  },
                ],
              },
              {
                name: "bar",
                rules: [
                  {
                    id: "C",
                  },
                  {
                    id: "D",
                  },
                ],
              },
            ],
          },
        } as Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).toBeUndefined();
      });

      it("should return undefined if tool extensions not set", () => {
        const result = {
          message: "msg",
          rule: {
            index: 1,
            toolComponent: {
              index: 1,
            },
          },
        } as Result;

        const sarifRun = {
          results: [result],
          tool: {
            // Extensions should be set here.
          },
        } as Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).toBeUndefined();
      });

      it("should return undefined if tool extensions do not contain index", () => {
        const result = {
          message: "msg",
          rule: {
            index: 1,
            toolComponent: {
              index: 1,
            },
          },
        } as Result;

        const sarifRun = {
          results: [result],
          tool: {
            extensions: [
              {
                name: "foo",
                rules: [
                  {
                    id: "A",
                  },
                  {
                    id: "B",
                  },
                ],
              },
              // There should be one more extension here (index 1).
            ],
          },
        } as Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).toBeUndefined();
      });

      it("should return rule if all information is defined", () => {
        const result = {
          message: "msg",
          ruleIndex: 1,
          rule: {
            index: 1,
            toolComponent: {
              index: 1,
            },
          },
        } as Result;

        const sarifRun = {
          results: [result],
          tool: {
            extensions: [
              {
                name: "foo",
                rules: [
                  {
                    id: "A",
                  },
                  {
                    id: "B",
                  },
                ],
              },
              {
                name: "bar",
                rules: [
                  {
                    id: "C",
                  },
                  {
                    id: "D",
                  },
                ],
              },
            ],
          },
        } as Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).toBeTruthy();
        expect(rule!.id).toBe("D");
      });
    });
  });

  describe("tryGetFilePath", () => {
    it("should return value when uri is a file path", () => {
      const physicalLocation: PhysicalLocation = {
        artifactLocation: {
          uri: "foo/bar",
        },
      };
      expect(tryGetFilePath(physicalLocation)).toBe("foo/bar");
    });

    it("should return undefined when uri has a file scheme", () => {
      const physicalLocation: PhysicalLocation = {
        artifactLocation: {
          uri: "file:/",
        },
      };
      expect(tryGetFilePath(physicalLocation)).toBe(undefined);
    });

    it("should return undefined when uri is empty", () => {
      const physicalLocation: PhysicalLocation = {
        artifactLocation: {
          uri: "",
        },
      };
      expect(tryGetFilePath(physicalLocation)).toBe(undefined);
    });

    it("should return undefined if artifact location uri is undefined", () => {
      const physicalLocation: PhysicalLocation = {
        artifactLocation: {
          uri: undefined,
        },
      };
      expect(tryGetFilePath(physicalLocation)).toBe(undefined);
    });

    it("should return undefined if artifact location is undefined", () => {
      const physicalLocation: PhysicalLocation = {
        artifactLocation: undefined,
      };
      expect(tryGetFilePath(physicalLocation)).toBe(undefined);
    });
  });

  describe("tryGetSeverity", () => {
    it("should return undefined if no rule set", () => {
      const result = {
        message: "msg",
      } as Result;

      // The rule should be set here.
      const rule: ReportingDescriptor | undefined = undefined;

      const sarifRun = {
        results: [result],
      } as Run;

      const severity = tryGetSeverity(sarifRun, result, rule);
      expect(severity).toBeUndefined();
    });

    it("should return undefined if severity not set on rule", () => {
      const result = {
        message: "msg",
        rule: {
          id: "A",
        },
      } as Result;

      const rule = {
        id: "A",
        properties: {
          // Severity not set
        },
      } as ReportingDescriptor;

      const sarifRun = {
        results: [result],
        tool: {
          driver: {
            rules: [rule, result.rule],
          },
        },
      } as Run;

      const severity = tryGetSeverity(sarifRun, result, rule);
      expect(severity).toBeUndefined();
    });

    const severityMap = {
      recommendation: "Recommendation",
      warning: "Warning",
      error: "Error",
    };

    Object.entries(severityMap).forEach(([sarifSeverity, parsedSeverity]) => {
      it(`should get ${parsedSeverity} severity`, () => {
        const result = {
          message: "msg",
          rule: {
            id: "A",
          },
        } as Result;

        const rule = {
          id: "A",
          properties: {
            "problem.severity": sarifSeverity,
          },
        } as ReportingDescriptor;

        const sarifRun = {
          results: [result],
          tool: {
            driver: {
              rules: [rule, result.rule],
            },
          },
        } as Run;

        const severity = tryGetSeverity(sarifRun, result, rule);
        expect(severity).toBe(parsedSeverity);
      });
    });
  });

  describe("extractAnalysisAlerts", () => {
    const fakefileLinkPrefix = "https://example.com";
    it("should not return any results if no runs found in the SARIF", () => {
      const sarif = {
        // Runs are missing here.
      } as Log;

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      expect(result).toBeTruthy();
      expect(result.alerts.length).toBe(0);
    });

    it("should not return any results for runs that have no results", () => {
      const sarif = {
        runs: [
          {
            results: [],
          },
          {
            // Results are missing here.
          },
        ],
      } as Log;

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      expect(result).toBeTruthy();
      expect(result.alerts.length).toBe(0);
    });

    it("should return errors for results that have no message", () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.message.text = undefined;

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      expect(result).toBeTruthy();
      expect(result.errors.length).toBe(1);
      expectResultParsingError(result.errors[0]);
    });

    it("should not return errors for result locations with no snippet", () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.contextRegion!.snippet =
        undefined;

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      const expectedCodeSnippet = {
        startLine: result.alerts[0].codeSnippet!.startLine,
        endLine: result.alerts[0].codeSnippet!.endLine,
        text: "",
      };

      const actualCodeSnippet = result.alerts[0].codeSnippet;

      expect(result).toBeTruthy();
      expectNoParsingError(result);
      expect(actualCodeSnippet).toEqual(expectedCodeSnippet);
    });

    it("should use highlightedRegion for result locations with no contextRegion", () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.contextRegion =
        undefined;

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      const expectedCodeSnippet = {
        startLine: result.alerts[0].highlightedRegion!.startLine,
        endLine: result.alerts[0].highlightedRegion!.endLine,
        text: "",
      };

      const actualCodeSnippet = result.alerts[0].codeSnippet;

      expect(result).toBeTruthy();
      expectNoParsingError(result);
      expect(actualCodeSnippet).toEqual(expectedCodeSnippet);
    });

    it("should not return errors for result locations with no region", () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.region =
        undefined;

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      expect(result).toBeTruthy();
      expect(result.alerts.length).toBe(1);
      expectNoParsingError(result);
    });

    it("should return errors for result locations with no physical location", () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.artifactLocation =
        undefined;

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      expect(result).toBeTruthy();
      expect(result.errors.length).toBe(1);
      expectResultParsingError(result.errors[0]);
    });

    it("should return results for all alerts", () => {
      const sarif = {
        version: "0.0.1" as Log.version,
        runs: [
          {
            results: [
              {
                message: {
                  text: "msg1",
                },
                locations: [
                  {
                    physicalLocation: {
                      contextRegion: {
                        startLine: 10,
                        endLine: 12,
                        snippet: {
                          text: "foo",
                        },
                      },
                      region: {
                        startLine: 10,
                        startColumn: 1,
                        endColumn: 3,
                      },
                      artifactLocation: {
                        uri: "foo.js",
                      },
                    },
                  },
                  {
                    physicalLocation: {
                      contextRegion: {
                        startLine: 10,
                        endLine: 12,
                        snippet: {
                          text: "bar",
                        },
                      },
                      region: {
                        startLine: 10,
                        startColumn: 1,
                        endColumn: 3,
                      },
                      artifactLocation: {
                        uri: "bar.js",
                      },
                    },
                  },
                ],
              },
              {
                message: {
                  text: "msg2",
                },
                locations: [
                  {
                    physicalLocation: {
                      contextRegion: {
                        startLine: 10,
                        endLine: 12,
                        snippet: {
                          text: "baz",
                        },
                      },
                      region: {
                        startLine: 10,
                        startColumn: 1,
                        endColumn: 3,
                      },
                      artifactLocation: {
                        uri: "baz.js",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      } as Log;

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);
      expect(result).toBeTruthy();
      expect(result.errors.length).toBe(0);
      expect(result.alerts.length).toBe(3);
      expect(
        result.alerts.find(
          (a) =>
            getMessageText(a.message) === "msg1" &&
            a.codeSnippet!.text === "foo",
        ),
      ).toBeTruthy();
      expect(
        result.alerts.find(
          (a) =>
            getMessageText(a.message) === "msg1" &&
            a.codeSnippet!.text === "bar",
        ),
      ).toBeTruthy();
      expect(
        result.alerts.find(
          (a) =>
            getMessageText(a.message) === "msg2" &&
            a.codeSnippet!.text === "baz",
        ),
      ).toBeTruthy();
      expect(result.alerts.every((a) => a.severity === "Warning")).toBe(true);
    });

    it("should deal with complex messages", () => {
      const sarif = buildValidSarifLog();
      const messageText =
        "This shell command depends on an uncontrolled [absolute path](1).";
      sarif.runs![0]!.results![0]!.message!.text = messageText;
      sarif.runs![0]!.results![0].relatedLocations = [
        {
          id: 1,
          physicalLocation: {
            artifactLocation: {
              uri: "npm-packages/meteor-installer/config.js",
            },
            region: {
              startLine: 35,
              startColumn: 20,
              endColumn: 60,
            },
          },
        },
      ];

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      expect(result).toBeTruthy();
      expect(result.errors.length).toBe(0);
      expect(result.alerts.length).toBe(1);
      const message = result.alerts[0].message;
      expect(message.tokens.length).toBe(3);
      expect(message.tokens[0].t).toBe("text");
      expect(message.tokens[0].text).toBe(
        "This shell command depends on an uncontrolled ",
      );
      expect(message.tokens[1].t).toBe("location");
      expect(message.tokens[1].text).toBe("absolute path");
      expect(
        (message.tokens[1] as AnalysisMessageLocationToken).location,
      ).toEqual({
        fileLink: {
          fileLinkPrefix: fakefileLinkPrefix,
          filePath: "npm-packages/meteor-installer/config.js",
        },
        highlightedRegion: {
          startLine: 35,
          startColumn: 20,
          endLine: 35,
          endColumn: 60,
        },
      });
      expect(message.tokens[2].t).toBe("text");
      expect(message.tokens[2].text).toBe(".");
    });

    it("should not include snippets for large snippets", () => {
      const sarif = buildValidSarifLog();
      // Build string of 10 kilobytes
      const snippet = new Array(10 * 1024).fill("a").join("");
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.contextRegion!.snippet =
        {
          text: snippet,
        };

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      const actualCodeSnippet = result.alerts[0].codeSnippet;

      expect(result).toBeTruthy();
      expectNoParsingError(result);
      expect(actualCodeSnippet).toBeUndefined();
    });

    it("should include snippets for large snippets which are relevant", () => {
      const sarif = buildValidSarifLog();
      // Build string of 10 kilobytes
      const snippet = new Array(10 * 1024).fill("a").join("");
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.contextRegion!.snippet =
        {
          text: snippet,
        };
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.region!.endColumn = 1000;

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      const actualCodeSnippet = result.alerts[0].codeSnippet;

      expect(result).toBeTruthy();
      expectNoParsingError(result);
      expect(actualCodeSnippet).not.toBeUndefined();
    });

    it("should be able to handle when a location has no uri", () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0].results![0].message.text = "message [String](1)";
      sarif.runs![0].results![0].relatedLocations = [
        {
          id: 1,
          physicalLocation: {
            artifactLocation: {
              uri: "file:/modules/java.base/java/lang/String.class",
              index: 1,
            },
          },
          message: {
            text: "String",
          },
        },
      ];

      const result = extractAnalysisAlerts(sarif, fakefileLinkPrefix);

      expect(result).toBeTruthy();
      expectNoParsingError(result);
      expect(result.alerts[0].codeSnippet).not.toBeUndefined();
      expect(result.alerts[0].message.tokens).toStrictEqual([
        {
          t: "text",
          text: "message ",
        },
        {
          t: "text",
          text: "String",
        },
        {
          t: "text",
          text: "",
        },
      ]);
    });
  });

  function expectResultParsingError(msg: string) {
    expect(msg.startsWith("Error when processing SARIF result")).toBe(true);
  }

  function expectNoParsingError(result: { errors: string[] }) {
    const array = result.errors;
    expect(array).toEqual([]);
  }

  function buildValidSarifLog(): Log {
    return {
      version: "2.1.0",
      runs: [
        {
          results: [
            {
              message: {
                text: "msg",
              },
              locations: [
                {
                  physicalLocation: {
                    contextRegion: {
                      startLine: 10,
                      endLine: 12,
                      snippet: {
                        text: "Foo",
                      },
                    },
                    region: {
                      startLine: 10,
                      startColumn: 1,
                      endColumn: 3,
                    },
                    artifactLocation: {
                      uri: "foo.js",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    } as Log;
  }

  function getMessageText(message: AnalysisMessage) {
    return message.tokens.map((t) => t.text).join("");
  }
});
