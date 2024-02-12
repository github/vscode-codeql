import { decodeBqrsToMethods } from "../../../src/model-editor/bqrs";
import type { DecodedBqrsChunk } from "../../../src/common/bqrs-cli-types";
import type { Method } from "../../../src/model-editor/method";
import {
  CallClassification,
  EndpointType,
} from "../../../src/model-editor/method";
import { Mode } from "../../../src/model-editor/shared/mode";
import { QueryLanguage } from "../../../src/common/query-language";

describe("decodeBqrsToMethods", () => {
  describe("Java queries", () => {
    describe("application mode query", () => {
      const chunk: DecodedBqrsChunk = {
        columns: [
          { name: "usage", kind: "Entity" },
          { kind: "String" },
          { kind: "String" },
          { kind: "String" },
          { kind: "String" },
          { name: "supported", kind: "Boolean" },
          { kind: "String" },
          { kind: "String" },
          { name: "type", kind: "String" },
          { name: "classification", kind: "String" },
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
            "java.io",
            "PrintStream",
            "println",
            "(String)",
            true,
            "rt.jar",
            "",
            "sink",
            "source",
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
            "org.springframework.boot",
            "SpringApplication",
            "run",
            "(Class,String[])",
            false,
            "spring-boot-3.0.2.jar",
            "",
            "none",
            "source",
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
            "org.sql2o",
            "Connection",
            "createQuery",
            "(String)",
            true,
            "sql2o-1.6.0.jar",
            "",
            "sink",
            "source",
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
            "org.sql2o",
            "Connection",
            "createQuery",
            "(String)",
            true,
            "sql2o-1.6.0.jar",
            "",
            "sink",
            "source",
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
            "org.sql2o",
            "Query",
            "executeScalar",
            "(Class)",
            true,
            "sql2o-1.6.0.jar",
            "",
            "sink",
            "source",
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
            "org.sql2o",
            "Query",
            "executeScalar",
            "(Class)",
            true,
            "sql2o-1.6.0.jar",
            "",
            "sink",
            "source",
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
            "org.sql2o",
            "Sql2o",
            "open",
            "()",
            true,
            "sql2o-1.6.0.jar",
            "",
            "sink",
            "source",
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
            "org.sql2o",
            "Sql2o",
            "open",
            "()",
            true,
            "sql2o-1.6.0.jar",
            "",
            "sink",
            "source",
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
            "org.sql2o",
            "Sql2o",
            "Sql2o",
            "(String,String,String)",
            true,
            "sql2o-1.6.0.jar",
            "",
            "sink",
            "source",
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
            "org.sql2o",
            "Sql2o",
            "Sql2o",
            "(String)",
            true,
            "sql2o-1.6.0.jar",
            "",
            "sink",
            "source",
          ],
        ],
      };

      it("extracts methods", () => {
        // Even though there are a number of methods with the same number of usages, the order returned should be stable:
        // - Iterating over a map (as done by .values()) is guaranteed to be in insertion order
        // - Sorting the array of methods is guaranteed to be a stable sort
        expect(
          decodeBqrsToMethods(chunk, Mode.Application, QueryLanguage.Java),
        ).toEqual([
          {
            library: "rt",
            libraryVersion: undefined,
            signature: "java.io.PrintStream#println(String)",
            endpointType: EndpointType.Method,
            packageName: "java.io",
            typeName: "PrintStream",
            methodName: "println",
            methodParameters: "(String)",
            supported: true,
            supportedType: "sink",
            usages: [
              {
                label: "println(...)",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 29,
                  startColumn: 9,
                  endLine: 29,
                  endColumn: 49,
                },
                classification: CallClassification.Source,
              },
            ],
          },
          {
            library: "spring-boot",
            libraryVersion: "3.0.2",
            signature:
              "org.springframework.boot.SpringApplication#run(Class,String[])",
            endpointType: EndpointType.Method,
            packageName: "org.springframework.boot",
            typeName: "SpringApplication",
            methodName: "run",
            methodParameters: "(Class,String[])",
            supported: false,
            supportedType: "none",
            usages: [
              {
                label: "run(...)",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/Sql2oExampleApplication.java",
                  startLine: 9,
                  startColumn: 9,
                  endLine: 9,
                  endColumn: 66,
                },
                classification: CallClassification.Source,
              },
            ],
          },
          {
            library: "sql2o",
            libraryVersion: "1.6.0",
            signature: "org.sql2o.Connection#createQuery(String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Connection",
            methodName: "createQuery",
            methodParameters: "(String)",
            supported: true,
            supportedType: "sink",
            usages: [
              {
                label: "createQuery(...)",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 15,
                  startColumn: 13,
                  endLine: 15,
                  endColumn: 56,
                },
                classification: CallClassification.Source,
              },
              {
                label: "createQuery(...)",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 26,
                  startColumn: 13,
                  endLine: 26,
                  endColumn: 39,
                },
                classification: CallClassification.Source,
              },
            ],
          },
          {
            library: "sql2o",
            libraryVersion: "1.6.0",
            signature: "org.sql2o.Query#executeScalar(Class)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Query",
            methodName: "executeScalar",
            methodParameters: "(Class)",
            supported: true,
            supportedType: "sink",
            usages: [
              {
                label: "executeScalar(...)",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 15,
                  startColumn: 13,
                  endLine: 15,
                  endColumn: 85,
                },
                classification: CallClassification.Source,
              },
              {
                label: "executeScalar(...)",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 26,
                  startColumn: 13,
                  endLine: 26,
                  endColumn: 68,
                },
                classification: CallClassification.Source,
              },
            ],
          },
          {
            library: "sql2o",
            libraryVersion: "1.6.0",
            signature: "org.sql2o.Sql2o#open()",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Sql2o",
            methodName: "open",
            methodParameters: "()",
            supported: true,
            supportedType: "sink",
            usages: [
              {
                label: "open(...)",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 14,
                  startColumn: 24,
                  endLine: 14,
                  endColumn: 35,
                },
                classification: CallClassification.Source,
              },
              {
                label: "open(...)",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 25,
                  startColumn: 24,
                  endLine: 25,
                  endColumn: 35,
                },
                classification: CallClassification.Source,
              },
            ],
          },
          {
            library: "sql2o",
            libraryVersion: "1.6.0",
            signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Sql2o",
            methodName: "Sql2o",
            methodParameters: "(String,String,String)",
            supported: true,
            supportedType: "sink",
            usages: [
              {
                label: "new Sql2o(...)",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 10,
                  startColumn: 33,
                  endLine: 10,
                  endColumn: 88,
                },
                classification: CallClassification.Source,
              },
            ],
          },
          {
            library: "sql2o",
            libraryVersion: "1.6.0",
            signature: "org.sql2o.Sql2o#Sql2o(String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Sql2o",
            methodName: "Sql2o",
            methodParameters: "(String)",
            supported: true,
            supportedType: "sink",
            usages: [
              {
                label: "new Sql2o(...)",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 23,
                  startColumn: 23,
                  endLine: 23,
                  endColumn: 36,
                },
                classification: CallClassification.Source,
              },
            ],
          },
        ] satisfies Method[]);
      });
    });

    describe("framework mode query", () => {
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
        ],
      };

      it("extracts methods", () => {
        expect(
          decodeBqrsToMethods(chunk, Mode.Framework, QueryLanguage.Java),
        ).toEqual([
          {
            library: "",
            libraryVersion: undefined,
            signature: "org.example.HelloController#connect(String)",
            endpointType: EndpointType.Method,
            packageName: "org.example",
            typeName: "HelloController",
            methodName: "connect",
            methodParameters: "(String)",
            supported: false,
            supportedType: "none",
            usages: [
              {
                label: "connect",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 22,
                  startColumn: 19,
                  endLine: 22,
                  endColumn: 25,
                },
                classification: CallClassification.Unknown,
              },
            ],
          },
          {
            library: "",
            libraryVersion: undefined,
            signature: "org.example.HelloController#index(String)",
            endpointType: EndpointType.Method,
            packageName: "org.example",
            typeName: "HelloController",
            methodName: "index",
            methodParameters: "(String)",
            supported: true,
            supportedType: "summary",
            usages: [
              {
                label: "index",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
                  startLine: 13,
                  startColumn: 19,
                  endLine: 13,
                  endColumn: 23,
                },
                classification: CallClassification.Unknown,
              },
            ],
          },
        ] satisfies Method[]);
      });
    });
  });

  describe("C# queries", () => {
    describe("application mode query", () => {
      const chunk: DecodedBqrsChunk = {
        columns: [
          { name: "usage", kind: "Entity" },
          { kind: "String" },
          { kind: "String" },
          { kind: "String" },
          { kind: "String" },
          { name: "supported", kind: "Boolean" },
          { kind: "String" },
          { kind: "String" },
          { name: "type", kind: "String" },
          { name: "classification", kind: "String" },
        ],
        tuples: [
          [
            {
              label: "call to method GetMethodInfo",
              url: {
                uri: "file:/home/runner/work/bulk-builder/bulk-builder/src/Moq/ActionObserver.cs",
                startLine: 74,
                startColumn: 40,
                endLine: 74,
                endColumn: 61,
              },
            },
            "System.Reflection",
            "RuntimeReflectionExtensions",
            "GetMethodInfo",
            "(System.Delegate)",
            true,
            "mscorlib",
            "4.0.0.0",
            "summary",
            "source",
          ],
        ],
      };

      it("extracts methods", () => {
        expect(
          decodeBqrsToMethods(chunk, Mode.Application, QueryLanguage.Java),
        ).toEqual([
          {
            library: "mscorlib",
            libraryVersion: "4.0.0.0",
            signature:
              "System.Reflection.RuntimeReflectionExtensions#GetMethodInfo(System.Delegate)",
            endpointType: EndpointType.Method,
            packageName: "System.Reflection",
            typeName: "RuntimeReflectionExtensions",
            methodName: "GetMethodInfo",
            methodParameters: "(System.Delegate)",
            supported: true,
            supportedType: "summary",
            usages: [
              {
                label: "call to method GetMethodInfo",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/bulk-builder/bulk-builder/src/Moq/ActionObserver.cs",
                  startLine: 74,
                  startColumn: 40,
                  endLine: 74,
                  endColumn: 61,
                },
                classification: CallClassification.Source,
              },
            ],
          },
        ] satisfies Method[]);
      });
    });

    describe("framework mode query", () => {
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
              label: "Validate",
              url: {
                uri: "file:/home/runner/work/bulk-builder/bulk-builder/src/Moq/Times.cs",
                startLine: 369,
                startColumn: 21,
                endLine: 369,
                endColumn: 28,
              },
            },
            "Moq",
            "Times",
            "Validate",
            "(System.Int32)",
            false,
            "Times.cs",
            "",
          ],
        ],
      };

      it("extracts methods", () => {
        expect(
          decodeBqrsToMethods(chunk, Mode.Framework, QueryLanguage.Java),
        ).toEqual([
          {
            library: "Times",
            libraryVersion: undefined,
            signature: "Moq.Times#Validate(System.Int32)",
            endpointType: EndpointType.Method,
            packageName: "Moq",
            typeName: "Times",
            methodName: "Validate",
            methodParameters: "(System.Int32)",
            supported: false,
            supportedType: "none",
            usages: [
              {
                label: "Validate",
                url: {
                  type: "lineColumnLocation",
                  uri: "file:/home/runner/work/bulk-builder/bulk-builder/src/Moq/Times.cs",
                  startLine: 369,
                  startColumn: 21,
                  endLine: 369,
                  endColumn: 28,
                },
                classification: CallClassification.Unknown,
              },
            ],
          },
        ] satisfies Method[]);
      });
    });
  });
});
