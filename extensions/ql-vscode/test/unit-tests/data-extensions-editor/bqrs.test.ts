import { decodeBqrsToExternalApiUsages } from "../../../src/data-extensions-editor/bqrs";
import { DecodedBqrsChunk } from "../../../src/common/bqrs-cli-types";

describe("decodeBqrsToExternalApiUsages", () => {
  const chunk: DecodedBqrsChunk = {
    columns: [
      { name: "usage", kind: "Entity" },
      { name: "apiName", kind: "String" },
      { kind: "String" },
      { kind: "String" },
    ],
    tuples: [
      [
        {
          label: "println(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 29,
            startColumn: 9,
            endLine: 29,
            endColumn: 49,
          },
        },
        "java.io.PrintStream#println(String)",
        "true",
        "supported",
      ],
      [
        {
          label: "run(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/Sql2oExampleApplication.java",
            startLine: 9,
            startColumn: 9,
            endLine: 9,
            endColumn: 66,
          },
        },
        "org.springframework.boot.SpringApplication#run(Class,String[])",
        "false",
        "supported",
      ],
      [
        {
          label: "createQuery(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 15,
            startColumn: 13,
            endLine: 15,
            endColumn: 56,
          },
        },
        "org.sql2o.Connection#createQuery(String)",
        "true",
        "supported",
      ],
      [
        {
          label: "createQuery(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 26,
            startColumn: 13,
            endLine: 26,
            endColumn: 39,
          },
        },
        "org.sql2o.Connection#createQuery(String)",
        "true",
        "supported",
      ],
      [
        {
          label: "executeScalar(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 15,
            startColumn: 13,
            endLine: 15,
            endColumn: 85,
          },
        },
        "org.sql2o.Query#executeScalar(Class)",
        "true",
        "supported",
      ],
      [
        {
          label: "executeScalar(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 26,
            startColumn: 13,
            endLine: 26,
            endColumn: 68,
          },
        },
        "org.sql2o.Query#executeScalar(Class)",
        "true",
        "supported",
      ],
      [
        {
          label: "open(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 14,
            startColumn: 24,
            endLine: 14,
            endColumn: 35,
          },
        },
        "org.sql2o.Sql2o#open()",
        "true",
        "supported",
      ],
      [
        {
          label: "open(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 25,
            startColumn: 24,
            endLine: 25,
            endColumn: 35,
          },
        },
        "org.sql2o.Sql2o#open()",
        "true",
        "supported",
      ],
      [
        {
          label: "new Sql2o(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 10,
            startColumn: 33,
            endLine: 10,
            endColumn: 88,
          },
        },
        "org.sql2o.Sql2o#Sql2o(String,String,String)",
        "true",
        "supported",
      ],
      [
        {
          label: "new Sql2o(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 23,
            startColumn: 23,
            endLine: 23,
            endColumn: 36,
          },
        },
        "org.sql2o.Sql2o#Sql2o(String)",
        "true",
        "supported",
      ],
    ],
  };

  it("extracts api usages", () => {
    // Even though there are a number of usages with the same number of usages, the order returned should be stable:
    // - Iterating over a map (as done by .values()) is guaranteed to be in insertion order
    // - Sorting the array of usages is guaranteed to be a stable sort
    expect(decodeBqrsToExternalApiUsages(chunk)).toEqual([
      {
        signature: "java.io.PrintStream#println(String)",
        packageName: "java.io",
        typeName: "PrintStream",
        methodName: "println",
        methodParameters: "(String)",
        supported: true,
        usages: [
          {
            label: "println(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
              startLine: 29,
              startColumn: 9,
              endLine: 29,
              endColumn: 49,
            },
          },
        ],
      },
      {
        signature:
          "org.springframework.boot.SpringApplication#run(Class,String[])",
        packageName: "org.springframework.boot",
        typeName: "SpringApplication",
        methodName: "run",
        methodParameters: "(Class,String[])",
        supported: false,
        usages: [
          {
            label: "run(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/Sql2oExampleApplication.java",
              startLine: 9,
              startColumn: 9,
              endLine: 9,
              endColumn: 66,
            },
          },
        ],
      },
      {
        signature: "org.sql2o.Connection#createQuery(String)",
        packageName: "org.sql2o",
        typeName: "Connection",
        methodName: "createQuery",
        methodParameters: "(String)",
        supported: true,
        usages: [
          {
            label: "createQuery(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
              startLine: 15,
              startColumn: 13,
              endLine: 15,
              endColumn: 56,
            },
          },
          {
            label: "createQuery(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
              startLine: 26,
              startColumn: 13,
              endLine: 26,
              endColumn: 39,
            },
          },
        ],
      },
      {
        signature: "org.sql2o.Query#executeScalar(Class)",
        packageName: "org.sql2o",
        typeName: "Query",
        methodName: "executeScalar",
        methodParameters: "(Class)",
        supported: true,
        usages: [
          {
            label: "executeScalar(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
              startLine: 15,
              startColumn: 13,
              endLine: 15,
              endColumn: 85,
            },
          },
          {
            label: "executeScalar(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
              startLine: 26,
              startColumn: 13,
              endLine: 26,
              endColumn: 68,
            },
          },
        ],
      },
      {
        signature: "org.sql2o.Sql2o#open()",
        packageName: "org.sql2o",
        typeName: "Sql2o",
        methodName: "open",
        methodParameters: "()",
        supported: true,
        usages: [
          {
            label: "open(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
              startLine: 14,
              startColumn: 24,
              endLine: 14,
              endColumn: 35,
            },
          },
          {
            label: "open(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
              startLine: 25,
              startColumn: 24,
              endLine: 25,
              endColumn: 35,
            },
          },
        ],
      },
      {
        signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
        packageName: "org.sql2o",
        typeName: "Sql2o",
        methodName: "Sql2o",
        methodParameters: "(String,String,String)",
        supported: true,
        usages: [
          {
            label: "new Sql2o(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
              startLine: 10,
              startColumn: 33,
              endLine: 10,
              endColumn: 88,
            },
          },
        ],
      },
      {
        signature: "org.sql2o.Sql2o#Sql2o(String)",
        packageName: "org.sql2o",
        typeName: "Sql2o",
        methodName: "Sql2o",
        methodParameters: "(String)",
        supported: true,
        usages: [
          {
            label: "new Sql2o(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
              startLine: 23,
              startColumn: 23,
              endLine: 23,
              endColumn: 36,
            },
          },
        ],
      },
    ]);
  });
});
