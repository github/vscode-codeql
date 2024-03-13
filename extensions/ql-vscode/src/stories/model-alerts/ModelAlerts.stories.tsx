import type { Meta, StoryFn } from "@storybook/react";

import { ModelAlerts as ModelAlertsComponent } from "../../view/model-alerts/ModelAlerts";
import { createMockModelEditorViewState } from "../../../test/factories/model-editor/view-state";

export default {
  title: "CodeQL Model Alerts/CodeQL Model Alerts",
  component: ModelAlertsComponent,
} as Meta<typeof ModelAlertsComponent>;

const Template: StoryFn<typeof ModelAlertsComponent> = (args) => (
  <ModelAlertsComponent {...args} />
);

export const ModelAlerts = Template.bind({});
ModelAlerts.args = {
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
    showLlmButton: true,
  }),
};
