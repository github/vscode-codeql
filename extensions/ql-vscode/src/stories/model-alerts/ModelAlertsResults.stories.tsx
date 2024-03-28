import type { Meta, StoryFn } from "@storybook/react";

import { ModelAlertsResults as ModelAlertsResultsComponent } from "../../view/model-alerts/ModelAlertsResults";
import { createSinkModeledMethod } from "../../../test/factories/model-editor/modeled-method-factories";
import { createMockAnalysisAlert } from "../../../test/factories/variant-analysis/shared/analysis-alert";

export default {
  title: "Model Alerts/Model Alerts Results",
  component: ModelAlertsResultsComponent,
} as Meta<typeof ModelAlertsResultsComponent>;

const Template: StoryFn<typeof ModelAlertsResultsComponent> = (args) => (
  <ModelAlertsResultsComponent {...args} />
);

export const ModelAlertsResults = Template.bind({});
ModelAlertsResults.args = {
  modelAlerts: {
    model: createSinkModeledMethod(),
    alerts: [
      {
        repository: {
          id: 1,
          fullName: "expressjs/express",
        },
        alert: createMockAnalysisAlert(),
      },
    ],
  },
};
