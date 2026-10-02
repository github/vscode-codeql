import {
  createDataExtension,
  createDataExtensionFilesForApplicationMode,
  createDataExtensionFilesForFrameworkMode,
  createExtensionlessFilenameForLibrary,
  createExtensionlessFilenameForPackage,
  ExtensionFormat,
  getFileExtensionFromFormat,
  loadDataExtensionFromObject,
  loadDataExtensionFromString,
  modelExtensionFileToString,
} from "../../../src/model-editor/extension-serialization";
import type { Method } from "../../../src/model-editor/method";
import {
  CallClassification,
  EndpointType,
} from "../../../src/model-editor/method";
import { QueryLanguage } from "../../../src/common/query-language";
import type { ModeledMethod } from "../../../src/model-editor/modeled-method";
import type { ModelExtensionFile } from "../../../src/model-editor/model-extension-file";

describe("createDataExtension", () => {
  it("creates the correct YAML file", () => {
    const yaml = createDataExtension(
      QueryLanguage.Java,
      [
        {
          type: "sink",
          input: "Argument[0]",
          kind: "sql",
          provenance: "df-generated",
          signature: "org.sql2o.Connection#createQuery(String)",
          endpointType: EndpointType.Method,
          packageName: "org.sql2o",
          typeName: "Connection",
          methodName: "createQuery",
          methodParameters: "(String)",
        },
      ],
      ExtensionFormat.Yaml,
    );

    expect(yaml).toEqual(`extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","df-generated"]

  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data: []
`);
  });

  it("includes the correct language", () => {
    const yaml = createDataExtension(
      QueryLanguage.CSharp,
      [],
      ExtensionFormat.Yaml,
    );

    expect(yaml).toEqual(`extensions:
  - addsTo:
      pack: codeql/csharp-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/csharp-all
      extensible: sinkModel
    data: []

  - addsTo:
      pack: codeql/csharp-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/csharp-all
      extensible: neutralModel
    data: []
`);
  });
});

describe("createDataExtensionYamlsForApplicationMode", () => {
  it("creates the correct YAML files when there are no existing modeled methods", () => {
    const yaml = createDataExtensionFilesForApplicationMode(
      QueryLanguage.Java,
      [
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
          supportedType: "neutral",
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
          libraryVersion: "2.5.0-alpha1",
          signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
          endpointType: EndpointType.Method,
          packageName: "org.sql2o",
          typeName: "Sql2o",
          methodName: "Sql2o",
          methodParameters: "(String,String,String)",
          supported: false,
          supportedType: "none",
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
          library: "rt",
          signature: "java.io.PrintStream#println(String)",
          endpointType: EndpointType.Method,
          packageName: "java.io",
          typeName: "PrintStream",
          methodName: "println",
          methodParameters: "(String)",
          supported: true,
          supportedType: "summary",
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
      ],
      {
        "org.sql2o.Connection#createQuery(String)": [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "sql",
            provenance: "df-generated",
            signature: "org.sql2o.Connection#createQuery(String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Connection",
            methodName: "createQuery",
            methodParameters: "(String)",
          },
        ],
        "org.springframework.boot.SpringApplication#run(Class,String[])": [
          {
            type: "neutral",
            kind: "summary",
            provenance: "manual",
            signature:
              "org.springframework.boot.SpringApplication#run(Class,String[])",
            endpointType: EndpointType.Method,
            packageName: "org.springframework.boot",
            typeName: "SpringApplication",
            methodName: "run",
            methodParameters: "(Class,String[])",
          },
        ],
        "org.sql2o.Sql2o#Sql2o(String,String,String)": [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "jndi",
            provenance: "manual",
            endpointType: EndpointType.Method,
            signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
            packageName: "org.sql2o",
            typeName: "Sql2o",
            methodName: "Sql2o",
            methodParameters: "(String,String,String)",
          },
        ],
      },
      {},
      ExtensionFormat.Yaml,
    );

    expect(yaml).toEqual({
      "models/sql2o.model.yml": `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","df-generated"]
      - ["org.sql2o","Sql2o",true,"Sql2o","(String,String,String)","","Argument[0]","jndi","manual"]

  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data: []
`,
      "models/spring-boot.model.yml": `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data:
      - ["org.springframework.boot","SpringApplication","run","(Class,String[])","summary","manual"]
`,
    });
  });

  it("creates the correct YAML files when there are existing modeled methods", () => {
    const yaml = createDataExtensionFilesForApplicationMode(
      QueryLanguage.Java,
      [
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
          supportedType: "neutral",
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
          libraryVersion: "2.5.0-alpha1",
          signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
          endpointType: EndpointType.Method,
          packageName: "org.sql2o",
          typeName: "Sql2o",
          methodName: "Sql2o",
          methodParameters: "(String,String,String)",
          supported: false,
          supportedType: "none",
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
          library: "rt",
          signature: "java.io.PrintStream#println(String)",
          endpointType: EndpointType.Method,
          packageName: "java.io",
          typeName: "PrintStream",
          methodName: "println",
          methodParameters: "(String)",
          supported: true,
          supportedType: "summary",
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
      ],
      {
        "org.sql2o.Connection#createQuery(String)": [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "sql",
            provenance: "df-generated",
            signature: "org.sql2o.Connection#createQuery(String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Connection",
            methodName: "createQuery",
            methodParameters: "(String)",
          },
        ],
        "org.springframework.boot.SpringApplication#run(Class,String[])": [
          {
            type: "neutral",
            kind: "summary",
            provenance: "manual",
            signature:
              "org.springframework.boot.SpringApplication#run(Class,String[])",
            endpointType: EndpointType.Method,
            packageName: "org.springframework.boot",
            typeName: "SpringApplication",
            methodName: "run",
            methodParameters: "(Class,String[])",
          },
        ],
        "org.sql2o.Sql2o#Sql2o(String,String,String)": [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "jndi",
            provenance: "manual",
            signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Sql2o",
            methodName: "Sql2o",
            methodParameters: "(String,String,String)",
          },
        ],
      },
      {
        "models/sql2o.model.yml": {
          "org.sql2o.Connection#createQuery(String)": [
            {
              type: "neutral",
              kind: "summary",
              provenance: "manual",
              signature: "org.sql2o.Connection#createQuery(String)",
              endpointType: EndpointType.Method,
              packageName: "org.sql2o",
              typeName: "Connection",
              methodName: "createQuery",
              methodParameters: "(String)",
            },
          ],
          "org.sql2o.Query#executeScalar(Class)": [
            {
              type: "neutral",
              kind: "summary",
              provenance: "manual",
              signature: "org.sql2o.Query#executeScalar(Class)",
              endpointType: EndpointType.Method,
              packageName: "org.sql2o",
              typeName: "Query",
              methodName: "executeScalar",
              methodParameters: "(Class)",
            },
          ],
        },
        "models/gson.model.yml": {
          "com.google.gson.TypeAdapter#fromJsonTree(JsonElement)": [
            {
              type: "summary",
              input: "Argument[this]",
              output: "ReturnValue",
              kind: "taint",
              provenance: "df-generated",
              signature:
                "com.google.gson.TypeAdapter#fromJsonTree(JsonElement)",
              endpointType: EndpointType.Method,
              packageName: "com.google.gson",
              typeName: "TypeAdapter",
              methodName: "fromJsonTree",
              methodParameters: "(JsonElement)",
            },
          ],
        },
      },
      ExtensionFormat.Yaml,
    );

    expect(yaml).toEqual({
      "models/sql2o.model.yml": `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","df-generated"]
      - ["org.sql2o","Sql2o",true,"Sql2o","(String,String,String)","","Argument[0]","jndi","manual"]

  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data:
      - ["org.sql2o","Query","executeScalar","(Class)","summary","manual"]
`,
      "models/spring-boot.model.yml": `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data:
      - ["org.springframework.boot","SpringApplication","run","(Class,String[])","summary","manual"]
`,
    });
  });

  it("preserves existing YAML files as YAML when the default format for new files is JSON", () => {
    const outputs = createDataExtensionFilesForApplicationMode(
      QueryLanguage.Java,
      [
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
          supportedType: "neutral",
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
          libraryVersion: "2.5.0-alpha1",
          signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
          endpointType: EndpointType.Method,
          packageName: "org.sql2o",
          typeName: "Sql2o",
          methodName: "Sql2o",
          methodParameters: "(String,String,String)",
          supported: false,
          supportedType: "none",
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
          library: "rt",
          signature: "java.io.PrintStream#println(String)",
          endpointType: EndpointType.Method,
          packageName: "java.io",
          typeName: "PrintStream",
          methodName: "println",
          methodParameters: "(String)",
          supported: true,
          supportedType: "summary",
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
      ],
      {
        "org.sql2o.Connection#createQuery(String)": [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "sql",
            provenance: "df-generated",
            signature: "org.sql2o.Connection#createQuery(String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Connection",
            methodName: "createQuery",
            methodParameters: "(String)",
          },
        ],
        "org.springframework.boot.SpringApplication#run(Class,String[])": [
          {
            type: "neutral",
            kind: "summary",
            provenance: "manual",
            signature:
              "org.springframework.boot.SpringApplication#run(Class,String[])",
            endpointType: EndpointType.Method,
            packageName: "org.springframework.boot",
            typeName: "SpringApplication",
            methodName: "run",
            methodParameters: "(Class,String[])",
          },
        ],
        "org.sql2o.Sql2o#Sql2o(String,String,String)": [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "jndi",
            provenance: "manual",
            signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Sql2o",
            methodName: "Sql2o",
            methodParameters: "(String,String,String)",
          },
        ],
      },
      {
        "models/sql2o.model.yml": {
          "org.sql2o.Connection#createQuery(String)": [
            {
              type: "neutral",
              kind: "summary",
              provenance: "manual",
              signature: "org.sql2o.Connection#createQuery(String)",
              endpointType: EndpointType.Method,
              packageName: "org.sql2o",
              typeName: "Connection",
              methodName: "createQuery",
              methodParameters: "(String)",
            },
          ],
          "org.sql2o.Query#executeScalar(Class)": [
            {
              type: "neutral",
              kind: "summary",
              provenance: "manual",
              signature: "org.sql2o.Query#executeScalar(Class)",
              endpointType: EndpointType.Method,
              packageName: "org.sql2o",
              typeName: "Query",
              methodName: "executeScalar",
              methodParameters: "(Class)",
            },
          ],
        },
        "models/gson.model.yml": {
          "com.google.gson.TypeAdapter#fromJsonTree(JsonElement)": [
            {
              type: "summary",
              input: "Argument[this]",
              output: "ReturnValue",
              kind: "taint",
              provenance: "df-generated",
              signature:
                "com.google.gson.TypeAdapter#fromJsonTree(JsonElement)",
              endpointType: EndpointType.Method,
              packageName: "com.google.gson",
              typeName: "TypeAdapter",
              methodName: "fromJsonTree",
              methodParameters: "(JsonElement)",
            },
          ],
        },
      },
      ExtensionFormat.Json,
    );

    expect(outputs).toEqual({
      "models/sql2o.model.yml": `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","df-generated"]
      - ["org.sql2o","Sql2o",true,"Sql2o","(String,String,String)","","Argument[0]","jndi","manual"]

  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data:
      - ["org.sql2o","Query","executeScalar","(Class)","summary","manual"]
`,
      "models/spring-boot.model.json": `{
  "extensions": [
    {
      "addsTo": {
        "pack": "codeql/java-all",
        "extensible": "sourceModel"
      },
      "data": []
    },
    {
      "addsTo": {
        "pack": "codeql/java-all",
        "extensible": "sinkModel"
      },
      "data": []
    },
    {
      "addsTo": {
        "pack": "codeql/java-all",
        "extensible": "summaryModel"
      },
      "data": []
    },
    {
      "addsTo": {
        "pack": "codeql/java-all",
        "extensible": "neutralModel"
      },
      "data": [
        ["org.springframework.boot","SpringApplication","run","(Class,String[])","summary","manual"]
      ]
    }
  ]
}`,
    });
  });
});

describe("createDataExtensionFilesForFrameworkMode", () => {
  it("creates the correct YAML files when there are no existing modeled methods", () => {
    const yaml = createDataExtensionFilesForFrameworkMode(
      QueryLanguage.Java,
      [
        {
          library: "sql2o",
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
          signature: "org.sql2o.Query#executeScalar(Class)",
          endpointType: EndpointType.Method,
          packageName: "org.sql2o",
          typeName: "Query",
          methodName: "executeScalar",
          methodParameters: "(Class)",
          supported: true,
          supportedType: "neutral",
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
          signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
          endpointType: EndpointType.Method,
          packageName: "org.sql2o",
          typeName: "Sql2o",
          methodName: "Sql2o",
          methodParameters: "(String,String,String)",
          supported: false,
          supportedType: "none",
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
      ],
      {
        "org.sql2o.Connection#createQuery(String)": [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "sql",
            provenance: "df-generated",
            signature: "org.sql2o.Connection#createQuery(String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Connection",
            methodName: "createQuery",
            methodParameters: "(String)",
          },
        ],
        "org.sql2o.Sql2o#Sql2o(String,String,String)": [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "jndi",
            provenance: "manual",
            signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Sql2o",
            methodName: "Sql2o",
            methodParameters: "(String,String,String)",
          },
        ],
      },
      {},
      ExtensionFormat.Yaml,
    );

    expect(yaml).toEqual({
      "models/org.sql2o.model.yml": `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","df-generated"]
      - ["org.sql2o","Sql2o",true,"Sql2o","(String,String,String)","","Argument[0]","jndi","manual"]

  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data: []
`,
    });
  });

  it("creates the correct YAML files when there are existing modeled methods", () => {
    const yaml = createDataExtensionFilesForFrameworkMode(
      QueryLanguage.Java,
      [
        {
          library: "sql2o",
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
          signature: "org.sql2o.Query#executeScalar(Class)",
          endpointType: EndpointType.Method,
          packageName: "org.sql2o",
          typeName: "Query",
          methodName: "executeScalar",
          methodParameters: "(Class)",
          supported: true,
          supportedType: "neutral",
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
          signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
          endpointType: EndpointType.Method,
          packageName: "org.sql2o",
          typeName: "Sql2o",
          methodName: "Sql2o",
          methodParameters: "(String,String,String)",
          supported: false,
          supportedType: "none",
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
      ],
      {
        "org.sql2o.Connection#createQuery(String)": [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "sql",
            provenance: "df-generated",
            signature: "org.sql2o.Connection#createQuery(String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Connection",
            methodName: "createQuery",
            methodParameters: "(String)",
          },
        ],
        "org.sql2o.Sql2o#Sql2o(String,String,String)": [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "jndi",
            provenance: "manual",
            signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
            endpointType: EndpointType.Method,
            packageName: "org.sql2o",
            typeName: "Sql2o",
            methodName: "Sql2o",
            methodParameters: "(String,String,String)",
          },
        ],
      },
      {
        "models/org.sql2o.model.yml": {
          "org.sql2o.Connection#createQuery(String)": [
            {
              type: "neutral",
              kind: "summary",
              provenance: "manual",
              signature: "org.sql2o.Connection#createQuery(String)",
              endpointType: EndpointType.Method,
              packageName: "org.sql2o",
              typeName: "Connection",
              methodName: "createQuery",
              methodParameters: "(String)",
            },
          ],
          "org.sql2o.Query#executeScalar(Class)": [
            {
              type: "neutral",
              kind: "summary",
              provenance: "manual",
              signature: "org.sql2o.Query#executeScalar(Class)",
              endpointType: EndpointType.Method,
              packageName: "org.sql2o",
              typeName: "Query",
              methodName: "executeScalar",
              methodParameters: "(Class)",
            },
          ],
        },
        "models/gson.model.yml": {
          "com.google.gson.TypeAdapter#fromJsonTree(JsonElement)": [
            {
              type: "summary",
              input: "Argument[this]",
              output: "ReturnValue",
              kind: "taint",
              provenance: "df-generated",
              signature:
                "com.google.gson.TypeAdapter#fromJsonTree(JsonElement)",
              endpointType: EndpointType.Method,
              packageName: "com.google.gson",
              typeName: "TypeAdapter",
              methodName: "fromJsonTree",
              methodParameters: "(JsonElement)",
            },
          ],
        },
      },
      ExtensionFormat.Yaml,
    );

    expect(yaml).toEqual({
      "models/org.sql2o.model.yml": `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","df-generated"]
      - ["org.sql2o","Sql2o",true,"Sql2o","(String,String,String)","","Argument[0]","jndi","manual"]

  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data:
      - ["org.sql2o","Query","executeScalar","(Class)","summary","manual"]
`,
    });
  });

  describe("with same package names but different capitalizations", () => {
    const methods: Method[] = [
      {
        library: "HostTestAppDbContext",
        signature:
          "Volo.Abp.TestApp.MongoDb.HostTestAppDbContext#get_FifthDbContextDummyEntity()",
        endpointType: EndpointType.Method,
        packageName: "Volo.Abp.TestApp.MongoDb",
        typeName: "HostTestAppDbContext",
        methodName: "get_FifthDbContextDummyEntity",
        methodParameters: "()",
        supported: false,
        supportedType: "none",
        usages: [],
      },
      {
        library: "CityRepository",
        signature:
          "Volo.Abp.TestApp.MongoDB.CityRepository#FindByNameAsync(System.String)",
        endpointType: EndpointType.Method,
        packageName: "Volo.Abp.TestApp.MongoDB",
        typeName: "CityRepository",
        methodName: "FindByNameAsync",
        methodParameters: "(System.String)",
        supported: false,
        supportedType: "none",
        usages: [],
      },
    ];
    const newModeledMethods: Record<string, ModeledMethod[]> = {
      "Volo.Abp.TestApp.MongoDb.HostTestAppDbContext#get_FifthDbContextDummyEntity()":
        [
          {
            type: "sink",
            input: "Argument[0]",
            kind: "sql",
            provenance: "df-generated",
            signature:
              "Volo.Abp.TestApp.MongoDb.HostTestAppDbContext#get_FifthDbContextDummyEntity()",
            endpointType: EndpointType.Method,
            packageName: "Volo.Abp.TestApp.MongoDb",
            typeName: "HostTestAppDbContext",
            methodName: "get_FifthDbContextDummyEntity",
            methodParameters: "()",
          },
        ],
      "Volo.Abp.TestApp.MongoDB.CityRepository#FindByNameAsync(System.String)":
        [
          {
            type: "neutral",
            kind: "summary",
            provenance: "df-generated",
            signature:
              "Volo.Abp.TestApp.MongoDB.CityRepository#FindByNameAsync(System.String)",
            endpointType: EndpointType.Method,
            packageName: "Volo.Abp.TestApp.MongoDB",
            typeName: "CityRepository",
            methodName: "FindByNameAsync",
            methodParameters: "(System.String)",
          },
        ],
    };
    const modelYaml = `extensions:
  - addsTo:
      pack: codeql/csharp-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/csharp-all
      extensible: sinkModel
    data:
      - ["Volo.Abp.TestApp.MongoDb","HostTestAppDbContext",true,"get_FifthDbContextDummyEntity","()","","Argument[0]","sql","df-generated"]

  - addsTo:
      pack: codeql/csharp-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/csharp-all
      extensible: neutralModel
    data:
      - ["Volo.Abp.TestApp.MongoDB","CityRepository","FindByNameAsync","(System.String)","summary","df-generated"]
`;

    it("creates the correct YAML files when there are existing modeled methods", () => {
      const yaml = createDataExtensionFilesForFrameworkMode(
        QueryLanguage.CSharp,
        methods,
        newModeledMethods,
        {},
        ExtensionFormat.Yaml,
      );

      expect(yaml).toEqual({
        "models/Volo.Abp.TestApp.MongoDB.model.yml": modelYaml,
      });
    });

    it("creates the correct YAML files when there are existing modeled methods", () => {
      const yaml = createDataExtensionFilesForFrameworkMode(
        QueryLanguage.CSharp,
        methods,
        newModeledMethods,
        {
          "models/Volo.Abp.TestApp.mongodb.model.yml": {
            "Volo.Abp.TestApp.MongoDB.CityRepository#FindByNameAsync(System.String)":
              [
                {
                  type: "neutral",
                  kind: "summary",
                  provenance: "manual",
                  signature:
                    "Volo.Abp.TestApp.MongoDB.CityRepository#FindByNameAsync(System.String)",
                  endpointType: EndpointType.Method,
                  packageName: "Volo.Abp.TestApp.MongoDB",
                  typeName: "CityRepository",
                  methodName: "FindByNameAsync",
                  methodParameters: "(System.String)",
                },
              ],
          },
        },
        ExtensionFormat.Yaml,
      );

      expect(yaml).toEqual({
        "models/Volo.Abp.TestApp.mongodb.model.yml": modelYaml,
      });
    });
  });
});

describe("loadDataExtensionFromObject", () => {
  it("loads from a deserialized YAML/JSON object", () => {
    const data = loadDataExtensionFromObject(
      {
        extensions: [
          {
            addsTo: { pack: "codeql/java-all", extensible: "sourceModel" },
            data: [],
          },
          {
            addsTo: { pack: "codeql/java-all", extensible: "sinkModel" },
            data: [
              [
                "org.sql2o",
                "Connection",
                true,
                "createQuery",
                "(String)",
                "",
                "Argument[0]",
                "sql",
                "manual",
              ],
            ],
          },
          {
            addsTo: { pack: "codeql/java-all", extensible: "summaryModel" },
            data: [],
          },
          {
            addsTo: { pack: "codeql/java-all", extensible: "neutralModel" },
            data: [],
          },
        ],
      },
      QueryLanguage.Java,
    );

    expect(data).toEqual({
      "org.sql2o.Connection#createQuery(String)": [
        {
          input: "Argument[0]",
          kind: "sql",
          type: "sink",
          provenance: "manual",
          signature: "org.sql2o.Connection#createQuery(String)",
          endpointType: EndpointType.Method,
          packageName: "org.sql2o",
          typeName: "Connection",
          methodName: "createQuery",
          methodParameters: "(String)",
        },
      ],
    } satisfies Record<string, ModeledMethod[]>);
  });

  it("returns undefined if given a string", () => {
    expect(() =>
      loadDataExtensionFromObject(
        `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","manual"]
`,
        QueryLanguage.Java,
      ),
    ).toThrow("Invalid data extension file:  must be object");
  });
});

describe("loadDataExtensionFromString", () => {
  it("loads from a YAML string", () => {
    const data = loadDataExtensionFromString(
      `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sourceModel
    data: []
  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o", "Connection", true, "createQuery", "(String)", "", "Argument[0]", "sql", "manual"]
      - ["com.github", "CodeQL", true, "doThing", "(int,int)", "", "Argument[1]", "foo", "df-generated"]
  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []
  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data: []
`,
      "test.model.yaml",
      QueryLanguage.Java,
    );

    expect(data).toEqual({
      "org.sql2o.Connection#createQuery(String)": [
        {
          input: "Argument[0]",
          kind: "sql",
          type: "sink",
          provenance: "manual",
          signature: "org.sql2o.Connection#createQuery(String)",
          endpointType: EndpointType.Method,
          packageName: "org.sql2o",
          typeName: "Connection",
          methodName: "createQuery",
          methodParameters: "(String)",
        },
      ],
      "com.github.CodeQL#doThing(int,int)": [
        {
          input: "Argument[1]",
          kind: "foo",
          type: "sink",
          provenance: "df-generated",
          signature: "com.github.CodeQL#doThing(int,int)",
          endpointType: EndpointType.Method,
          packageName: "com.github",
          typeName: "CodeQL",
          methodName: "doThing",
          methodParameters: "(int,int)",
        },
      ],
    } satisfies Record<string, ModeledMethod[]>);
  });

  it("returns undefined if given a string", () => {
    expect(() =>
      loadDataExtensionFromObject(
        `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","manual"]
`,
        QueryLanguage.Java,
      ),
    ).toThrow("Invalid data extension file:  must be object");
  });
});

describe("createExtensionlessFilenameForLibrary", () => {
  const testCases = [
    {
      library: "sql2o",
      filename: "models/sql2o.model",
    },
    {
      library: "spring-boot",
      filename: "models/spring-boot.model",
    },
    {
      library: "spring--boot",
      filename: "models/spring-boot.model",
    },
    {
      library: "rt",
      filename: "models/rt.model",
    },
    {
      library: "System.Runtime",
      filename: "models/system.runtime.model",
    },
    {
      library: "System..Runtime",
      filename: "models/system.runtime.model",
    },
  ];

  test.each(testCases)(
    "returns $filename if library name is $library",
    ({ library, filename }) => {
      expect(createExtensionlessFilenameForLibrary(library)).toEqual(filename);
    },
  );
});

describe("createExtensionlessFilenameForPackage", () => {
  const testCases = [
    {
      library: "System.Net.Http.Headers",
      filename: "models/System.Net.Http.Headers.model",
    },
    {
      library: "System.Security.Cryptography.X509Certificates",
      filename: "models/System.Security.Cryptography.X509Certificates.model",
    },
    {
      library: "com.google.common.io",
      filename: "models/com.google.common.io.model",
    },
    {
      library: "hudson.cli",
      filename: "models/hudson.cli.model",
    },
    {
      library: "java.util",
      filename: "models/java.util.model",
    },
    {
      library: "org.apache.commons.io",
      filename: "models/org.apache.commons.io.model",
    },
  ];

  test.each(testCases)(
    "returns $filename if package name is $library",
    ({ library, filename }) => {
      expect(createExtensionlessFilenameForPackage(library)).toEqual(filename);
    },
  );
});

describe("getFileExtensionFromFormat", () => {
  expect(getFileExtensionFromFormat(ExtensionFormat.Yaml)).toBe(".yml");
  expect(getFileExtensionFromFormat(ExtensionFormat.Json)).toBe(".json");
});

describe("modelExtensionFileToString", () => {
  const modelExtensionFile: ModelExtensionFile = {
    extensions: [
      {
        addsTo: {
          pack: "acme/super-pack",
          extensible: "fooModel",
        },
        data: [
          ["abc", 123, true],
          ["def", 124, false],
        ],
      },
    ],
  };
  it("should return YAML", () => {
    expect(modelExtensionFileToString(modelExtensionFile, ExtensionFormat.Yaml))
      .toBe(`extensions:
  - addsTo:
      pack: acme/super-pack
      extensible: fooModel
    data:
      - ["abc",123,true]
      - ["def",124,false]
`);
  });
  it("should return YAML with a header comment", () => {
    expect(
      modelExtensionFileToString(
        modelExtensionFile,
        ExtensionFormat.Yaml,
        "Test header comment",
      ),
    ).toBe(`# Test header comment

extensions:
  - addsTo:
      pack: acme/super-pack
      extensible: fooModel
    data:
      - ["abc",123,true]
      - ["def",124,false]
`);
  });
  it("should return JSON", () => {
    expect(modelExtensionFileToString(modelExtensionFile, ExtensionFormat.Json))
      .toBe(`{
  "extensions": [
    {
      "addsTo": {
        "pack": "acme/super-pack",
        "extensible": "fooModel"
      },
      "data": [
        ["abc",123,true],
        ["def",124,false]
      ]
    }
  ]
}`);
  });
  it("should return JSON with a header comment", () => {
    expect(
      modelExtensionFileToString(
        modelExtensionFile,
        ExtensionFormat.Json,
        "Test header comment",
      ),
    ).toBe(`// Test header comment

{
  "extensions": [
    {
      "addsTo": {
        "pack": "acme/super-pack",
        "extensible": "fooModel"
      },
      "data": [
        ["abc",123,true],
        ["def",124,false]
      ]
    }
  ]
}`);
  });
});
