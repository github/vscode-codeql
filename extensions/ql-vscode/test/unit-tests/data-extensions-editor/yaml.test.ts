import {
  createDataExtensionYaml,
  createDataExtensionYamlsForApplicationMode,
  createDataExtensionYamlsForFrameworkMode,
  createFilenameForLibrary,
  loadDataExtensionYaml,
} from "../../../src/data-extensions-editor/yaml";

describe("createDataExtensionYaml", () => {
  it("creates the correct YAML file", () => {
    const yaml = createDataExtensionYaml("java", [
      {
        externalApiUsage: {
          library: "sql2o-1.6.0.jar",
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
        modeledMethod: {
          type: "sink",
          input: "Argument[0]",
          output: "",
          kind: "sql",
          provenance: "df-generated",
        },
      },
      {
        externalApiUsage: {
          library: "sql2o-1.6.0.jar",
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
    const yaml = createDataExtensionYaml("csharp", []);

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
  it("creates the correct YAML files", () => {
    const yaml = createDataExtensionYamlsForApplicationMode(
      "java",
      [
        {
          library: "sql2o-1.6.0.jar",
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
          library: "sql2o-1.6.0.jar",
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
          library: "sql2o-2.5.0-alpha1.jar",
          signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
          packageName: "org.sql2o",
          typeName: "Sql2o",
          methodName: "Sql2o",
          methodParameters: "(String,String,String)",
          supported: false,
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
          library: "spring-boot-3.0.2.jar",
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
          library: "rt.jar",
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
      ],
      {
        "org.sql2o.Connection#createQuery(String)": {
          type: "sink",
          input: "Argument[0]",
          output: "",
          kind: "sql",
          provenance: "df-generated",
        },
        "org.springframework.boot.SpringApplication#run(Class,String[])": {
          type: "neutral",
          input: "",
          output: "",
          kind: "summary",
          provenance: "manual",
        },
        "org.sql2o.Sql2o#Sql2o(String,String,String)": {
          type: "sink",
          input: "Argument[0]",
          output: "",
          kind: "jndi",
          provenance: "manual",
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
});

describe("createDataExtensionYamlsForFrameworkMode", () => {
  it("creates the correct YAML files", () => {
    const yaml = createDataExtensionYamlsForFrameworkMode(
      "github/sql2o",
      "java",
      [
        {
          library: "sql2o",
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
          library: "sql2o",
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
          library: "sql2o",
          signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
          packageName: "org.sql2o",
          typeName: "Sql2o",
          methodName: "Sql2o",
          methodParameters: "(String,String,String)",
          supported: false,
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
      ],
      {
        "org.sql2o.Connection#createQuery(String)": {
          type: "sink",
          input: "Argument[0]",
          output: "",
          kind: "sql",
          provenance: "df-generated",
        },
        "org.sql2o.Sql2o#Sql2o(String,String,String)": {
          type: "sink",
          input: "Argument[0]",
          output: "",
          kind: "jndi",
          provenance: "manual",
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
    data: []
`,
    });
  });
});

describe("loadDataExtensionYaml", () => {
  it("loads the YAML file", () => {
    const data = loadDataExtensionYaml({
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
    });

    expect(data).toEqual({
      "org.sql2o.Connection#createQuery(String)": {
        input: "Argument[0]",
        kind: "sql",
        output: "",
        type: "sink",
        provenance: "manual",
      },
    });
  });

  it("returns undefined if given a string", () => {
    expect(() =>
      loadDataExtensionYaml(`extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","manual"]
`),
    ).toThrow("Invalid data extension YAML:  must be object");
  });
});

describe("createFilenameForLibrary", () => {
  const testCases = [
    { library: "sql2o.jar", filename: "models/sql2o.model.yml" },
    {
      library: "sql2o-1.6.0.jar",
      filename: "models/sql2o.model.yml",
    },
    {
      library: "spring-boot-3.0.2.jar",
      filename: "models/spring-boot.model.yml",
    },
    {
      library: "spring-boot-v3.0.2.jar",
      filename: "models/spring-boot.model.yml",
    },
    {
      library: "spring-boot-3.0.2-alpha1.jar",
      filename: "models/spring-boot.model.yml",
    },
    {
      library: "spring-boot-3.0.2beta2.jar",
      filename: "models/spring-boot.model.yml",
    },
    {
      library: "rt.jar",
      filename: "models/rt.model.yml",
    },
    {
      library: "System.Runtime.dll",
      filename: "models/system.runtime.model.yml",
    },
    {
      library: "System.Runtime.1.5.0.dll",
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
