import * as React from "react";

import { ComponentMeta, ComponentStory } from "@storybook/react";

import { MethodRow as MethodRowComponent } from "../../view/data-extensions-editor/MethodRow";
import { CallClassification } from "../../data-extensions-editor/external-api-usage";

export default {
  title: "Data Extensions Editor/Method Row",
  component: MethodRowComponent,
} as ComponentMeta<typeof MethodRowComponent>;

const Template: ComponentStory<typeof MethodRowComponent> = (args) => (
  <MethodRowComponent {...args} />
);

export const MethodRow = Template.bind({});
MethodRow.args = {
  externalApiUsage: {
    library: "sql2o-1.6.0.jar",
    signature: "org.sql2o.Sql2o#open()",
    packageName: "org.sql2o",
    typeName: "Sql2o",
    methodName: "open",
    methodParameters: "()",
    supported: true,
    supportedType: "summary",
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
        classification: CallClassification.Source,
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
        classification: CallClassification.Source,
      },
    ],
  },
  modeledMethod: {
    type: "summary",
    input: "Argument[this]",
    output: "ReturnValue",
    kind: "taint",
    provenance: "manual",
    signature: "org.sql2o.Sql2o#open()",
    packageName: "org.sql2o",
    typeName: "Sql2o",
    methodName: "open",
    methodParameters: "()",
  },
};
