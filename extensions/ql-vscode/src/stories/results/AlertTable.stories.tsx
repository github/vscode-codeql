import type { Meta, StoryFn } from "@storybook/react";
import { action } from "@storybook/addon-actions";

import { AlertTable as AlertTableComponent } from "../../view/results/AlertTable";

import "../../view/results/resultsView.css";
import { AlertTableHeader } from "../../view/results/AlertTableHeader";
import { AlertTableNoResults } from "../../view/results/AlertTableNoResults";

export default {
  title: "Results/Alert Table",
  component: AlertTableComponent,
} as Meta<typeof AlertTableComponent>;

const Template: StoryFn<typeof AlertTableComponent> = (args) => (
  <AlertTableComponent {...args} />
);

export const WithoutCodeFlows = Template.bind({});
WithoutCodeFlows.args = {
  results: [
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/internal/Streams.java",
              uriBaseId: "%SRCROOT%",
              index: 0,
            },
            region: { startLine: 98, startColumn: 35, endColumn: 37 },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "1d25c2fbd979cbb:1",
        primaryLocationStartColumnFingerprint: "30",
      },
    },
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/internal/Streams.java",
              uriBaseId: "%SRCROOT%",
              index: 0,
            },
            region: { startLine: 99, startColumn: 35, endColumn: 37 },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "5c5ed8d70236498a:1",
        primaryLocationStartColumnFingerprint: "30",
      },
    },
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/internal/UnsafeAllocator.java",
              uriBaseId: "%SRCROOT%",
              index: 1,
            },
            region: {
              startLine: 66,
              startColumn: 33,
              endLine: 68,
              endColumn: 6,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "bd306a1ab438981d:1",
        primaryLocationStartColumnFingerprint: "28",
      },
    },
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/internal/UnsafeAllocator.java",
              uriBaseId: "%SRCROOT%",
              index: 1,
            },
            region: {
              startLine: 91,
              startColumn: 33,
              endLine: 93,
              endColumn: 6,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "b91980e3f3ee2a16:1",
        primaryLocationStartColumnFingerprint: "28",
      },
    },
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/internal/ReflectionAccessFilterHelper.java",
              uriBaseId: "%SRCROOT%",
              index: 2,
            },
            region: {
              startLine: 100,
              startColumn: 49,
              endLine: 102,
              endColumn: 10,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "e4d69f1851f45b95:1",
        primaryLocationStartColumnFingerprint: "40",
      },
    },
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/internal/UnsafeAllocator.java",
              uriBaseId: "%SRCROOT%",
              index: 1,
            },
            region: {
              startLine: 112,
              startColumn: 33,
              endLine: 114,
              endColumn: 6,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "f3fb11daf511ebdb:1",
        primaryLocationStartColumnFingerprint: "28",
      },
    },
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/internal/bind/DateTypeAdapter.java",
              uriBaseId: "%SRCROOT%",
              index: 3,
            },
            region: {
              startLine: 84,
              startColumn: 42,
              endLine: 86,
              endColumn: 10,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "65a5e0f08a26f7fd:1",
        primaryLocationStartColumnFingerprint: "33",
      },
    },
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/internal/bind/DefaultDateTypeAdapter.java",
              uriBaseId: "%SRCROOT%",
              index: 4,
            },
            region: {
              startLine: 157,
              startColumn: 42,
              endLine: 159,
              endColumn: 10,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "c7647299ca3416a7:1",
        primaryLocationStartColumnFingerprint: "33",
      },
    },
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/internal/bind/JsonTreeWriter.java",
              uriBaseId: "%SRCROOT%",
              index: 5,
            },
            region: {
              startLine: 227,
              startColumn: 52,
              endLine: 228,
              endColumn: 4,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "d86e48478bd5f82f:1",
        primaryLocationStartColumnFingerprint: "49",
      },
    },
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/stream/JsonReader.java",
              uriBaseId: "%SRCROOT%",
              index: 6,
            },
            region: {
              startLine: 969,
              startColumn: 47,
              endLine: 971,
              endColumn: 8,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "3bc8c477478d1d94:1",
        primaryLocationStartColumnFingerprint: "40",
      },
    },
    {
      ruleId: "java/example/empty-block",
      ruleIndex: 0,
      rule: { id: "java/example/empty-block", index: 0 },
      message: { text: "This is a empty block." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: "gson/src/main/java/com/google/gson/stream/JsonReader.java",
              uriBaseId: "%SRCROOT%",
              index: 6,
            },
            region: {
              startLine: 1207,
              startColumn: 47,
              endLine: 1209,
              endColumn: 8,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: "3bc8c477478d1d94:2",
        primaryLocationStartColumnFingerprint: "40",
      },
    },
  ],
  sourceLocationPrefix: "/home/runner/work/gson/gson",
  numTruncatedResults: 0,
  databaseUri: "file:///a/b/c/java",
  header: <AlertTableHeader sortState={undefined} />,
  noResults: (
    <AlertTableNoResults
      nonemptyRawResults={true}
      showRawResults={() => action("show-raw-results")}
    />
  ),
};

export const WithCodeFlows = Template.bind({});
WithCodeFlows.args = {
  results: [
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
  ],
  sourceLocationPrefix: "/home/runner/work/sql2o-example/sql2o-example",
  numTruncatedResults: 0,
  databaseUri: "file:///a/b/c/java",
  header: <AlertTableHeader sortState={undefined} />,
  noResults: (
    <AlertTableNoResults
      nonemptyRawResults={true}
      showRawResults={() => action("show-raw-results")}
    />
  ),
};
