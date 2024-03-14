import type { Meta, StoryFn } from "@storybook/react";

import { ModelAlerts as ModelAlertsComponent } from "../../view/model-alerts/ModelAlerts";

export default {
  title: "CodeQL Model Alerts/CodeQL Model Alerts",
  component: ModelAlertsComponent,
} as Meta<typeof ModelAlertsComponent>;

const Template: StoryFn<typeof ModelAlertsComponent> = (args) => (
  <ModelAlertsComponent {...args} />
);

export const ModelAlerts = Template.bind({});
ModelAlerts.args = {
  initialViewState: { title: "codeql/sql2o-models" },
};
