import type { Meta, StoryFn } from "@storybook/react";

import { ModelAlertsHeader as ModelAlertsHeaderComponent } from "../../view/model-alerts/ModelAlertsHeader";
import { createMockVariantAnalysis } from "../../../test/factories/variant-analysis/shared/variant-analysis";

export default {
  title: "Model Alerts/Model Alerts Header",
  component: ModelAlertsHeaderComponent,
  argTypes: {
    openModelPackClick: {
      action: "open-model-pack-clicked",
      table: {
        disable: true,
      },
    },
    onViewLogsClick: {
      action: "view-logs-clicked",
      table: {
        disable: true,
      },
    },
    stopRunClick: {
      action: "stop-run-clicked",
      table: {
        disable: true,
      },
    },
  },
} as Meta<typeof ModelAlertsHeaderComponent>;

const Template: StoryFn<typeof ModelAlertsHeaderComponent> = (args) => (
  <ModelAlertsHeaderComponent {...args} />
);

export const ModelAlertsHeader = Template.bind({});
ModelAlertsHeader.args = {
  viewState: { title: "codeql/sql2o-models" },
  variantAnalysis: createMockVariantAnalysis({
    modelPacks: [
      {
        name: "Model pack 1",
        path: "/path/to/model-pack-1",
      },
      {
        name: "Model pack 2",
        path: "/path/to/model-pack-2",
      },
      {
        name: "Model pack 3",
        path: "/path/to/model-pack-3",
      },
      {
        name: "Model pack 4",
        path: "/path/to/model-pack-4",
      },
    ],
  }),
};
