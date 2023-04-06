import {
  createDataExtensionYaml,
  loadDataExtensionYaml,
} from "../../../src/data-extensions-editor/yaml";

describe("createDataExtensionYaml", () => {
  it("creates the correct YAML file", () => {
    const yaml = createDataExtensionYaml(
      [
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
      ],
      {
        "org.sql2o.Connection#createQuery(String)": {
          type: "sink",
          input: "Argument[0]",
          output: "",
          kind: "sql",
        },
      },
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
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","manual"]

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
      },
    });
  });

  it("returns undefined if given a string", () => {
    const data = loadDataExtensionYaml(`extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data:
      - ["org.sql2o","Connection",true,"createQuery","(String)","","Argument[0]","sql","manual"]
`);

    expect(data).toBeUndefined();
  });
});
