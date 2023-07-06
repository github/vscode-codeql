import {
  compareInputOutput,
  createAutoModelRequest,
  parsePredictedClassifications,
} from "../../../src/data-extensions-editor/auto-model";
import { ExternalApiUsage } from "../../../src/data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../../src/data-extensions-editor/modeled-method";
import {
  ClassificationType,
  Method,
} from "../../../src/data-extensions-editor/auto-model-api";
import { Mode } from "../../../src/data-extensions-editor/shared/mode";

describe("createAutoModelRequest", () => {
  const externalApiUsages: ExternalApiUsage[] = [
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
      library: "sql2o-1.6.0.jar",
      signature: "org.sql2o.Connection#createQuery(String)",
      packageName: "org.sql2o",
      typeName: "Connection",
      methodName: "createQuery",
      methodParameters: "(String)",
      supported: false,
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
      supported: false,
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
      library: "sql2o-1.6.0.jar",
      signature: "org.sql2o.Sql2o#open()",
      packageName: "org.sql2o",
      typeName: "Sql2o",
      methodName: "open",
      methodParameters: "()",
      supported: false,
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
      library: "rt.jar",
      signature: "java.io.PrintStream#println(String)",
      packageName: "java.io",
      typeName: "PrintStream",
      methodName: "println",
      methodParameters: "(String)",
      supported: false,
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
      library: "sql2o-1.6.0.jar",
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
      library: "sql2o-1.6.0.jar",
      signature: "org.sql2o.Sql2o#Sql2o(String)",
      packageName: "org.sql2o",
      typeName: "Sql2o",
      methodName: "Sql2o",
      methodParameters: "(String)",
      supported: false,
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
    {
      library: "test.jar",
      signature: "org.test.MyClass#test()",
      packageName: "org.test",
      typeName: "MyClass",
      methodName: "test",
      methodParameters: "()",
      supported: true,
      usages: [
        {
          label: "abc.test(...)",
          url: {
            uri: "file:/home/runner/work/test/Test.java",
            startLine: 23,
            startColumn: 23,
            endLine: 23,
            endColumn: 36,
          },
        },
      ],
    },
  ];

  const modeledMethods: Record<string, ModeledMethod> = {
    "org.sql2o.Sql2o#open()": {
      type: "neutral",
      kind: "",
      input: "",
      output: "",
      provenance: "manual",
    },
    "org.sql2o.Sql2o#Sql2o(String)": {
      type: "sink",
      kind: "jndi-injection",
      input: "Argument[0]",
      output: "",
      provenance: "manual",
    },
  };

  const usages: Record<string, string[]> = {
    "org.springframework.boot.SpringApplication#run(Class,String[])": [
      "public class Sql2oExampleApplication {\n    public static void main(String[] args) {\n        SpringApplication.run(Sql2oExampleApplication.class, args);\n    }\n}",
    ],
    "org.sql2o.Connection#createQuery(String)": [
      '    public String index(@RequestParam("id") String id) {\n        try (var con = sql2o.open()) {\n            con.createQuery("select 1 where id = " + id).executeScalar(Integer.class);\n        }\n\n',
      '\n        try (var con = sql2o.open()) {\n            con.createQuery("select 1").executeScalar(Integer.class);\n        }\n\n',
    ],
    "org.sql2o.Query#executeScalar(Class)": [
      '    public String index(@RequestParam("id") String id) {\n        try (var con = sql2o.open()) {\n            con.createQuery("select 1 where id = " + id).executeScalar(Integer.class);\n        }\n\n',
      '\n        try (var con = sql2o.open()) {\n            con.createQuery("select 1").executeScalar(Integer.class);\n        }\n\n',
    ],
    "org.sql2o.Sql2o#open()": [
      '    @GetMapping("/")\n    public String index(@RequestParam("id") String id) {\n        try (var con = sql2o.open()) {\n            con.createQuery("select 1 where id = " + id).executeScalar(Integer.class);\n        }\n',
      '        Sql2o sql2o = new Sql2o(url);\n\n        try (var con = sql2o.open()) {\n            con.createQuery("select 1").executeScalar(Integer.class);\n        }\n',
    ],
    "java.io.PrintStream#println(String)": [
      '        }\n\n        System.out.println("Connected to " + url);\n\n        return "Greetings from Spring Boot!";\n',
    ],
    "org.sql2o.Sql2o#Sql2o(String,String,String)": [
      '@RestController\npublic class HelloController {\n    private final Sql2o sql2o = new Sql2o("jdbc:h2:mem:test;DB_CLOSE_DELAY=-1","sa", "");\n\n    @GetMapping("/")\n',
    ],
    "org.sql2o.Sql2o#Sql2o(String)": [
      '    @GetMapping("/connect")\n    public String connect(@RequestParam("url") String url) {\n        Sql2o sql2o = new Sql2o(url);\n\n        try (var con = sql2o.open()) {\n',
    ],
  };

  it("creates a matching request", () => {
    expect(
      createAutoModelRequest(
        "java",
        externalApiUsages,
        modeledMethods,
        usages,
        Mode.Application,
      ),
    ).toEqual({
      language: "java",
      samples: [
        {
          package: "org.sql2o",
          type: "Sql2o",
          name: "open",
          signature: "()",
          classification: {
            type: "CLASSIFICATION_TYPE_NEUTRAL",
            kind: "",
            explanation: "",
          },
          usages: usages["org.sql2o.Sql2o#open()"],
          input: "Argument[this]",
        },
        {
          package: "org.sql2o",
          type: "Sql2o",
          name: "Sql2o",
          signature: "(String)",
          classification: {
            type: "CLASSIFICATION_TYPE_SINK",
            kind: "jndi-injection",
            explanation: "",
          },
          usages: usages["org.sql2o.Sql2o#Sql2o(String)"],
          input: "Argument[this]",
        },
        {
          package: "org.sql2o",
          type: "Sql2o",
          name: "Sql2o",
          signature: "(String)",
          classification: {
            type: "CLASSIFICATION_TYPE_SINK",
            kind: "jndi-injection",
            explanation: "",
          },
          usages: usages["org.sql2o.Sql2o#Sql2o(String)"],
          input: "Argument[0]",
        },
      ],
      candidates: [
        {
          package: "org.sql2o",
          type: "Connection",
          name: "createQuery",
          signature: "(String)",
          usages: usages["org.sql2o.Connection#createQuery(String)"],
          input: "Argument[this]",
          classification: undefined,
        },
        {
          package: "org.sql2o",
          type: "Connection",
          name: "createQuery",
          signature: "(String)",
          usages: usages["org.sql2o.Connection#createQuery(String)"],
          input: "Argument[0]",
          classification: undefined,
        },
        {
          package: "org.sql2o",
          type: "Query",
          name: "executeScalar",
          signature: "(Class)",
          usages: usages["org.sql2o.Query#executeScalar(Class)"],
          input: "Argument[this]",
          classification: undefined,
        },
        {
          package: "org.sql2o",
          type: "Query",
          name: "executeScalar",
          signature: "(Class)",
          usages: usages["org.sql2o.Query#executeScalar(Class)"],
          input: "Argument[0]",
          classification: undefined,
        },
        {
          package: "org.sql2o",
          type: "Sql2o",
          name: "Sql2o",
          signature: "(String,String,String)",
          usages: usages["org.sql2o.Sql2o#Sql2o(String,String,String)"],
          input: "Argument[this]",
          classification: undefined,
        },
        {
          package: "org.sql2o",
          type: "Sql2o",
          name: "Sql2o",
          signature: "(String,String,String)",
          usages: usages["org.sql2o.Sql2o#Sql2o(String,String,String)"],
          input: "Argument[0]",
          classification: undefined,
        },
        {
          package: "org.sql2o",
          type: "Sql2o",
          name: "Sql2o",
          signature: "(String,String,String)",
          usages: usages["org.sql2o.Sql2o#Sql2o(String,String,String)"],
          input: "Argument[1]",
          classification: undefined,
        },
        {
          package: "org.sql2o",
          type: "Sql2o",
          name: "Sql2o",
          signature: "(String,String,String)",
          usages: usages["org.sql2o.Sql2o#Sql2o(String,String,String)"],
          input: "Argument[2]",
          classification: undefined,
        },
        {
          package: "java.io",
          type: "PrintStream",
          name: "println",
          signature: "(String)",
          usages: usages["java.io.PrintStream#println(String)"],
          input: "Argument[this]",
          classification: undefined,
        },
        {
          package: "java.io",
          type: "PrintStream",
          name: "println",
          signature: "(String)",
          usages: usages["java.io.PrintStream#println(String)"],
          input: "Argument[0]",
          classification: undefined,
        },
        {
          package: "org.springframework.boot",
          type: "SpringApplication",
          name: "run",
          signature: "(Class,String[])",
          usages:
            usages[
              "org.springframework.boot.SpringApplication#run(Class,String[])"
            ],
          input: "Argument[this]",
          classification: undefined,
        },
        {
          package: "org.springframework.boot",
          type: "SpringApplication",
          name: "run",
          signature: "(Class,String[])",
          usages:
            usages[
              "org.springframework.boot.SpringApplication#run(Class,String[])"
            ],
          input: "Argument[0]",
          classification: undefined,
        },
        {
          package: "org.springframework.boot",
          type: "SpringApplication",
          name: "run",
          signature: "(Class,String[])",
          usages:
            usages[
              "org.springframework.boot.SpringApplication#run(Class,String[])"
            ],
          input: "Argument[1]",
          classification: undefined,
        },
      ],
    });
  });
});

describe("parsePredictedClassifications", () => {
  const predictions: Method[] = [
    {
      package: "org.sql2o",
      type: "Sql2o",
      name: "createQuery",
      signature: "(String)",
      usages: ["createQuery(...)", "createQuery(...)"],
      input: "Argument[0]",
      classification: {
        type: ClassificationType.Sink,
        kind: "sql injection sink",
        explanation: "",
      },
    },
    {
      package: "org.sql2o",
      type: "Sql2o",
      name: "executeScalar",
      signature: "(Class)",
      usages: ["executeScalar(...)", "executeScalar(...)"],
      input: "Argument[0]",
      classification: {
        type: ClassificationType.Neutral,
        kind: "",
        explanation: "not a sink",
      },
    },
    {
      package: "org.sql2o",
      type: "Sql2o",
      name: "Sql2o",
      signature: "(String,String,String)",
      usages: ["new Sql2o(...)"],
      input: "Argument[0]",
      classification: {
        type: ClassificationType.Neutral,
        kind: "",
        explanation: "not a sink",
      },
    },
    {
      package: "org.sql2o",
      type: "Sql2o",
      name: "Sql2o",
      signature: "(String,String,String)",
      usages: ["new Sql2o(...)"],
      input: "Argument[1]",
      classification: {
        type: ClassificationType.Sink,
        kind: "sql injection sink",
        explanation: "",
      },
    },
    {
      package: "org.sql2o",
      type: "Sql2o",
      name: "Sql2o",
      signature: "(String,String,String)",
      usages: ["new Sql2o(...)"],
      input: "Argument[2]",
      classification: {
        type: ClassificationType.Sink,
        kind: "sql injection sink",
        explanation: "",
      },
    },
  ];

  it("correctly parses the output", () => {
    expect(parsePredictedClassifications(predictions)).toEqual({
      "org.sql2o.Sql2o#createQuery(String)": {
        type: "sink",
        kind: "sql injection sink",
        input: "Argument[0]",
        output: "",
        provenance: "ai-generated",
      },
      "org.sql2o.Sql2o#executeScalar(Class)": {
        type: "neutral",
        kind: "summary",
        input: "",
        output: "",
        provenance: "ai-generated",
      },
      "org.sql2o.Sql2o#Sql2o(String,String,String)": {
        type: "sink",
        kind: "sql injection sink",
        input: "Argument[1]",
        output: "",
        provenance: "ai-generated",
      },
    });
  });
});

describe("compareInputOutput", () => {
  it("with two small numeric arguments", () => {
    expect(
      compareInputOutput("Argument[0]", "Argument[1]"),
    ).toBeLessThanOrEqual(-1);
  });

  it("with one larger non-alphabetic argument", () => {
    expect(
      compareInputOutput("Argument[10]", "Argument[2]"),
    ).toBeGreaterThanOrEqual(1);
  });

  it("with one non-numeric arguments", () => {
    expect(
      compareInputOutput("Argument[5]", "Argument[this]"),
    ).toBeLessThanOrEqual(-1);
  });

  it("with two non-numeric arguments", () => {
    expect(
      compareInputOutput("ReturnValue", "Argument[this]"),
    ).toBeGreaterThanOrEqual(1);
  });

  it("with one unknown argument in the a position", () => {
    expect(
      compareInputOutput("FooBar", "Argument[this]"),
    ).toBeGreaterThanOrEqual(1);
  });

  it("with one unknown argument in the b position", () => {
    expect(compareInputOutput("Argument[this]", "FooBar")).toBeLessThanOrEqual(
      -1,
    );
  });

  it("with one empty string arguments", () => {
    expect(compareInputOutput("Argument[5]", "")).toBeLessThanOrEqual(-1);
  });

  it("with two unknown arguments", () => {
    expect(compareInputOutput("FooBar", "BarFoo")).toBeGreaterThanOrEqual(1);
  });
});
