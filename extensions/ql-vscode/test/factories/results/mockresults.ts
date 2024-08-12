import type { Result } from "sarif";

export function createMockResults(): Result[] {
  return [
    {
      ruleId: "java/sql-injection",
      ruleIndex: 0,
      rule: { id: "java/sql-injection", index: 0 },
      message: {
        text: "This query depends on a [user-provided value](1).",
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "src/main/java/org/example/HelloController.java",
              uriBaseId: "%SRCROOT%",
              index: 0,
            },
            region: { startLine: 15, startColumn: 29, endColumn: 56 },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "87e2d3cc5b365094:1",
        primaryLocationStartColumnFingerprint: "16",
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
                        uri: "src/main/java/org/example/HelloController.java",
                        uriBaseId: "%SRCROOT%",
                        index: 0,
                      },
                      region: {
                        startLine: 13,
                        startColumn: 25,
                        endColumn: 54,
                      },
                    },
                    message: { text: "id : String" },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "file:/",
                        index: 5,
                      },
                      region: {
                        startLine: 13,
                        startColumn: 25,
                        endColumn: 54,
                      },
                    },
                    message: { text: "id : String" },
                  },
                },
                {
                  location: {
                    physicalLocation: {
                      artifactLocation: {
                        uri: "src/main/java/org/example/HelloController.java",
                        uriBaseId: "%SRCROOT%",
                        index: 0,
                      },
                      region: {
                        startLine: 15,
                        startColumn: 29,
                        endColumn: 56,
                      },
                    },
                    message: { text: "... + ..." },
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
              uri: "src/main/java/org/example/HelloController.java",
              uriBaseId: "%SRCROOT%",
              index: 0,
            },
            region: { startLine: 13, startColumn: 25, endColumn: 54 },
          },
          message: { text: "user-provided value" },
        },
      ],
    },
  ];
}
