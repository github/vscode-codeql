import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { MethodRow as MethodRowComponent } from "../../view/model-editor/MethodRow";
import {
  CallClassification,
  ExternalApiUsage,
} from "../../model-editor/external-api-usage";
import { ModeledMethod } from "../../model-editor/modeled-method";
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

const externalApiUsage: ExternalApiUsage = {
  library: "sql2o-1.6.0.jar",
  signature: "org.sql2o.Sql2o#open()",
  packageName: "org.sql2o",
  typeName: "Sql2o",
  methodName: "open",
  methodParameters: "()",
  supported: false,
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
};
const modeledMethod: ModeledMethod = {
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
};

export const Unmodeled = Template.bind({});
Unmodeled.args = {
  externalApiUsage,
  modeledMethod: undefined,
};

export const Source = Template.bind({});
Source.args = {
  externalApiUsage,
  modeledMethod: { ...modeledMethod, type: "source" },
};

export const Sink = Template.bind({});
Sink.args = {
  externalApiUsage,
  modeledMethod: { ...modeledMethod, type: "sink" },
};

export const Summary = Template.bind({});
Summary.args = {
  externalApiUsage,
  modeledMethod: { ...modeledMethod, type: "summary" },
};

export const Neutral = Template.bind({});
Neutral.args = {
  externalApiUsage,
  modeledMethod: { ...modeledMethod, type: "neutral" },
};

export const AlreadyModeled = Template.bind({});
AlreadyModeled.args = {
  externalApiUsage: { ...externalApiUsage, supported: true },
  modeledMethod: undefined,
};
