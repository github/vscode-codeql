import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { MethodRow as MethodRowComponent } from "../../view/model-editor/MethodRow";
import { CallClassification } from "../../model-editor/external-api-usage";
import { VSCodeDataGrid } from "@vscode/webview-ui-toolkit/react";
import { GRID_TEMPLATE_COLUMNS } from "../../view/model-editor/ModeledMethodDataGrid";

export default {
  title: "CodeQL Model Editor/Method Row",
  component: MethodRowComponent,
} as Meta<typeof MethodRowComponent>;

const Template: StoryFn<typeof MethodRowComponent> = (args) => (
  <VSCodeDataGrid gridTemplateColumns={GRID_TEMPLATE_COLUMNS}>
    <MethodRowComponent {...args} />
  </VSCodeDataGrid>
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
