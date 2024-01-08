import {
  bqrsToResultSet,
  mapUrlValue,
} from "../../../src/common/bqrs-raw-results-mapper";
import type {
  BqrsResultSetSchema,
  DecodedBqrsChunk,
} from "../../../src/common/bqrs-cli-types";
import { ColumnKind } from "../../../src/common/raw-result-types";

describe("bqrsToResultSet", () => {
  const schema: BqrsResultSetSchema = {
    name: "#select",
    columns: [
      {
        name: "endpoint",
        kind: "e",
      },
      {
        kind: "s",
      },
      {
        kind: "s",
      },
      {
        kind: "s",
      },
      {
        kind: "s",
      },
      {
        name: "supported",
        kind: "b",
      },
      {
        kind: "s",
      },
      {
        name: "type",
        kind: "s",
      },
    ],
    rows: 2,
  };

  const chunk: DecodedBqrsChunk = {
    columns: [
      { name: "endpoint", kind: "Entity" },
      { kind: "String" },
      { kind: "String" },
      { kind: "String" },
      { kind: "String" },
      { name: "supported", kind: "Boolean" },
      { kind: "String" },
      { name: "type", kind: "String" },
    ],
    tuples: [
      [
        {
          label: "connect",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 22,
            startColumn: 19,
            endLine: 22,
            endColumn: 25,
          },
        },
        "org.example",
        "HelloController",
        "connect",
        "(String)",
        false,
        "example",
        "",
      ],
      [
        {
          label: "index",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 13,
            startColumn: 19,
            endLine: 13,
            endColumn: 23,
          },
        },
        "org.example",
        "HelloController",
        "index",
        "(String)",
        true,
        "example",
        "summary",
      ],
      [
        {
          label: "index",
          url: "file://home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java:15:19:15:23",
        },
        "org.example",
        "HelloController",
        "index",
        "(String)",
        true,
        "example",
        "summary",
      ],
    ],
  };

  it("creates a result set", () => {
    expect(bqrsToResultSet(schema, chunk)).toEqual({
      name: "#select",
      totalRowCount: 2,
      columns: [
        {
          name: "endpoint",
          kind: ColumnKind.Entity,
        },
        {
          kind: ColumnKind.String,
        },
        {
          kind: ColumnKind.String,
        },
        {
          kind: ColumnKind.String,
        },
        {
          kind: ColumnKind.String,
        },
        {
          name: "supported",
          kind: ColumnKind.Boolean,
        },
        {
          kind: ColumnKind.String,
        },
        {
          name: "type",
          kind: ColumnKind.String,
        },
      ],
      rows: [
        [
          {
            type: "entity",
            value: {
              label: "connect",
              url: {
                type: "lineColumnLocation",
                uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                startLine: 22,
                startColumn: 19,
                endLine: 22,
                endColumn: 25,
              },
            },
          },
          {
            type: "string",
            value: "org.example",
          },
          {
            type: "string",
            value: "HelloController",
          },
          {
            type: "string",
            value: "connect",
          },
          {
            type: "string",
            value: "(String)",
          },
          {
            type: "boolean",
            value: false,
          },
          {
            type: "string",
            value: "example",
          },
          {
            type: "string",
            value: "",
          },
        ],
        [
          {
            type: "entity",
            value: {
              label: "index",
              url: {
                type: "lineColumnLocation",
                uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                startLine: 13,
                startColumn: 19,
                endLine: 13,
                endColumn: 23,
              },
            },
          },
          {
            type: "string",
            value: "org.example",
          },
          {
            type: "string",
            value: "HelloController",
          },
          {
            type: "string",
            value: "index",
          },
          {
            type: "string",
            value: "(String)",
          },
          {
            type: "boolean",
            value: true,
          },
          {
            type: "string",
            value: "example",
          },
          {
            type: "string",
            value: "summary",
          },
        ],
        [
          {
            type: "entity",
            value: {
              label: "index",
              url: {
                type: "lineColumnLocation",
                uri: "home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                startLine: 15,
                startColumn: 19,
                endLine: 15,
                endColumn: 23,
              },
            },
          },
          {
            type: "string",
            value: "org.example",
          },
          {
            type: "string",
            value: "HelloController",
          },
          {
            type: "string",
            value: "index",
          },
          {
            type: "string",
            value: "(String)",
          },
          {
            type: "boolean",
            value: true,
          },
          {
            type: "string",
            value: "example",
          },
          {
            type: "string",
            value: "summary",
          },
        ],
      ],
    });
  });
});

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
