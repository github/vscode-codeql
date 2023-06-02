import * as React from "react";

import { ComponentMeta, ComponentStory } from "@storybook/react";

import { DataExtensionsEditor as DataExtensionsEditorComponent } from "../../view/data-extensions-editor/DataExtensionsEditor";

export default {
  title: "Data Extensions Editor/Data Extensions Editor",
  component: DataExtensionsEditorComponent,
} as ComponentMeta<typeof DataExtensionsEditorComponent>;

const Template: ComponentStory<typeof DataExtensionsEditorComponent> = (
  args,
) => <DataExtensionsEditorComponent {...args} />;

export const DataExtensionsEditor = Template.bind({});
DataExtensionsEditor.args = {
  initialViewState: {
    extensionPackModelFile: {
      extensionPack: {
        path: "/home/user/vscode-codeql-starter/codeql-custom-queries-java/sql2o",
        yamlPath:
          "/home/user/vscode-codeql-starter/codeql-custom-queries-java/sql2o/codeql-pack.yml",
        name: "codeql/sql2o-models",
        version: "0.0.0",
        extensionTargets: {},
        dataExtensions: [],
      },
      filename:
        "/home/user/vscode-codeql-starter/codeql-custom-queries-java/sql2o/models/sql2o.yml",
    },
    modelFileExists: true,
    showLlmButton: true,
  },
  initialExternalApiUsages: [
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
  ],
  initialModeledMethods: {
    "org.sql2o.Sql2o#Sql2o(String)": {
      type: "sink",
      input: "Argument[0]",
      output: "",
      kind: "jndi-injection",
      provenance: "df-generated",
    },
    "org.sql2o.Connection#createQuery(String)": {
      type: "summary",
      input: "Argument[this]",
      output: "ReturnValue",
      kind: "taint",
      provenance: "df-manual",
    },
    "org.sql2o.Sql2o#open()": {
      type: "summary",
      input: "Argument[this]",
      output: "ReturnValue",
      kind: "taint",
      provenance: "manual",
    },
    "org.sql2o.Query#executeScalar(Class)": {
      type: "neutral",
      input: "",
      output: "",
      kind: "",
      provenance: "df-generated",
    },
    "org.sql2o.Sql2o#Sql2o(String,String,String)": {
      type: "neutral",
      input: "",
      output: "",
      kind: "",
      provenance: "df-generated",
    },
  },
};
