import {
  createDataExtensionYaml,
  createDataExtensionYamlsForApplicationMode,
  createDataExtensionYamlsForFrameworkMode,
  createFilenameForLibrary,
  createFilenameForPackage,
  loadDataExtensionYaml,
} from "../../../src/model-editor/yaml";
import type { Method } from "../../../src/model-editor/method";
import {
  CallClassification,
  EndpointType,
} from "../../../src/model-editor/method";
import { QueryLanguage } from "../../../src/common/query-language";
import type { ModeledMethod } from "../../../src/model-editor/modeled-method";

describe("createDataExtensionYaml", () => {
  it("creates the correct YAML file", () => {
    const yaml = createDataExtensionYaml(QueryLanguage.Java, [
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
    ]);

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
    const yaml = createDataExtensionYaml(QueryLanguage.CSharp, []);

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
    const yaml = createDataExtensionYamlsForApplicationMode(
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
    const yaml = createDataExtensionYamlsForApplicationMode(
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
});

describe("createDataExtensionYamlsForFrameworkMode", () => {
  it("creates the correct YAML files when there are no existing modeled methods", () => {
    const yaml = createDataExtensionYamlsForFrameworkMode(
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
    const yaml = createDataExtensionYamlsForFrameworkMode(
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
      const yaml = createDataExtensionYamlsForFrameworkMode(
        QueryLanguage.CSharp,
        methods,
        newModeledMethods,
        {},
      );

      expect(yaml).toEqual({
        "models/Volo.Abp.TestApp.MongoDB.model.yml": modelYaml,
      });
    });

    it("creates the correct YAML files when there are existing modeled methods", () => {
      const yaml = createDataExtensionYamlsForFrameworkMode(
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
      );

      expect(yaml).toEqual({
        "models/Volo.Abp.TestApp.mongodb.model.yml": modelYaml,
      });
    });
  });
});

describe("loadDataExtensionYaml", () => {
  it("loads the YAML file", () => {
    const data = loadDataExtensionYaml(
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
      loadDataExtensionYaml(
        `extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","manual"]
`,
        QueryLanguage.Java,
      ),
    ).toThrow("Invalid data extension YAML:  must be object");
  });
});

describe("createFilenameForLibrary", () => {
  const testCases = [
    {
      library: "sql2o",
      filename: "models/sql2o.model.yml",
    },
    {
      library: "spring-boot",
      filename: "models/spring-boot.model.yml",
    },
    {
      library: "spring--boot",
      filename: "models/spring-boot.model.yml",
    },
    {
      library: "rt",
      filename: "models/rt.model.yml",
    },
    {
      library: "System.Runtime",
      filename: "models/system.runtime.model.yml",
    },
    {
      library: "System..Runtime",
      filename: "models/system.runtime.model.yml",
    },
  ];

  test.each(testCases)(
    "returns $filename if library name is $library",
    ({ library, filename }) => {
      expect(createFilenameForLibrary(library)).toEqual(filename);
    },
  );
});

describe("createFilenameForPackage", () => {
  const testCases = [
    {
      library: "System.Net.Http.Headers",
      filename: "models/System.Net.Http.Headers.model.yml",
    },
    {
      library: "System.Security.Cryptography.X509Certificates",
      filename:
        "models/System.Security.Cryptography.X509Certificates.model.yml",
    },
    {
      library: "com.google.common.io",
      filename: "models/com.google.common.io.model.yml",
    },
    {
      library: "hudson.cli",
      filename: "models/hudson.cli.model.yml",
    },
    {
      library: "java.util",
      filename: "models/java.util.model.yml",
    },
    {
      library: "org.apache.commons.io",
      filename: "models/org.apache.commons.io.model.yml",
    },
  ];

  test.each(testCases)(
    "returns $filename if package name is $library",
    ({ library, filename }) => {
      expect(createFilenameForPackage(library)).toEqual(filename);
    },
  );
});
