import type { Meta, StoryFn } from "@storybook/react";

import { ModelEditor as ModelEditorComponent } from "../../view/model-editor/ModelEditor";
import { CallClassification, EndpointType } from "../../model-editor/method";
import { createMockModelEditorViewState } from "../../../test/factories/model-editor/view-state";

export default {
  title: "CodeQL Model Editor/CodeQL Model Editor",
  component: ModelEditorComponent,
} as Meta<typeof ModelEditorComponent>;

const Template: StoryFn<typeof ModelEditorComponent> = (args) => (
  <ModelEditorComponent {...args} />
);

export const ModelEditor = Template.bind({});
ModelEditor.args = {
  initialViewState: createMockModelEditorViewState({
    extensionPack: {
      path: "/home/user/vscode-codeql-starter/codeql-custom-queries-java/sql2o",
      yamlPath:
        "/home/user/vscode-codeql-starter/codeql-custom-queries-java/sql2o/codeql-pack.yml",
      name: "codeql/sql2o-models",
      version: "0.0.0",
      language: "java",
      extensionTargets: {},
      dataExtensions: [],
    },
    showGenerateButton: true,
  }),
  initialMethods: [
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
      supportedType: "summary",
      usages: Array(10).fill({
        label: "createQuery(...)",
        url: {
          uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
          startLine: 15,
          startColumn: 13,
          endLine: 15,
          endColumn: 56,
        },
        classification: CallClassification.Source,
      }),
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
      usages: Array(2).fill({
        label: "executeScalar(...)",
        url: {
          uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
          startLine: 15,
          startColumn: 13,
          endLine: 15,
          endColumn: 85,
        },
        classification: CallClassification.Source,
      }),
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
      supported: false,
      supportedType: "none",
      usages: Array(28).fill({
        label: "open(...)",
        url: {
          uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
          startLine: 14,
          startColumn: 24,
          endLine: 14,
          endColumn: 35,
        },
        classification: CallClassification.Source,
      }),
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
        {
          label: "println(...)",
          url: {
            type: "lineColumnLocation",
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/test/java/org/example/HelloControllerTest.java",
            startLine: 29,
            startColumn: 9,
            endLine: 29,
            endColumn: 49,
          },
          classification: CallClassification.Test,
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
      usages: Array(7).fill({
        label: "run(...)",
        url: {
          uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/Sql2oExampleApplication.java",
          startLine: 9,
          startColumn: 9,
          endLine: 9,
          endColumn: 66,
        },
        classification: CallClassification.Source,
      }),
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
      supported: false,
      supportedType: "none",
      usages: Array(106).fill({
        label: "new Sql2o(...)",
        url: {
          uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
          startLine: 10,
          startColumn: 33,
          endLine: 10,
          endColumn: 88,
          classification: CallClassification.Test,
        },
      }),
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
      supported: false,
      supportedType: "none",
      usages: [
        ...Array(4).fill({
          label: "new Sql2o(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
            startLine: 23,
            startColumn: 23,
            endLine: 23,
            endColumn: 36,
          },
          classification: CallClassification.Test,
        }),
        {
          label: "new Sql2o(...)",
          url: {
            uri: "file:/home/runner/work/sql2o-example/sql2o-example/build/generated/java/org/example/HelloControllerGenerated.java",
            startLine: 23,
            startColumn: 23,
            endLine: 23,
            endColumn: 36,
          },
          classification: CallClassification.Generated,
        },
      ],
    },
  ],
  initialModeledMethods: {
    "org.sql2o.Sql2o#Sql2o(String)": [
      {
        type: "sink",
        input: "Argument[0]",
        kind: "jndi-injection",
        provenance: "df-generated",
        signature: "org.sql2o.Sql2o#Sql2o(String)",
        endpointType: EndpointType.Method,
        packageName: "org.sql2o",
        typeName: "Sql2o",
        methodName: "Sql2o",
        methodParameters: "(String)",
      },
    ],
    "org.sql2o.Connection#createQuery(String)": [
      {
        type: "summary",
        input: "Argument[this]",
        output: "ReturnValue",
        kind: "taint",
        provenance: "df-manual",
        signature: "org.sql2o.Connection#createQuery(String)",
        endpointType: EndpointType.Method,
        packageName: "org.sql2o",
        typeName: "Connection",
        methodName: "createQuery",
        methodParameters: "(String)",
      },
    ],
    "org.sql2o.Sql2o#open()": [
      {
        type: "summary",
        input: "Argument[this]",
        output: "ReturnValue",
        kind: "taint",
        provenance: "manual",
        signature: "org.sql2o.Sql2o#open()",
        endpointType: EndpointType.Method,
        packageName: "org.sql2o",
        typeName: "Sql2o",
        methodName: "open",
        methodParameters: "()",
      },
    ],
    "org.sql2o.Query#executeScalar(Class)": [
      {
        type: "neutral",
        kind: "sink",
        provenance: "df-generated",
        signature: "org.sql2o.Query#executeScalar(Class)",
        endpointType: EndpointType.Method,
        packageName: "org.sql2o",
        typeName: "Query",
        methodName: "executeScalar",
        methodParameters: "(Class)",
      },
    ],
    "org.sql2o.Sql2o#Sql2o(String,String,String)": [
      {
        type: "neutral",
        kind: "sink",
        provenance: "df-generated",
        signature: "org.sql2o.Sql2o#Sql2o(String,String,String)",
        endpointType: EndpointType.Method,
        packageName: "org.sql2o",
        typeName: "Sql2o",
        methodName: "Sql2o",
        methodParameters: "(String,String,String)",
      },
    ],
  },
};
