import type { Meta, StoryFn } from "@storybook/react";

import { ModelAlertsHeader as ModelAlertsHeaderComponent } from "../../view/model-alerts/ModelAlertsHeader";
import { createMockVariantAnalysis } from "../../../test/factories/variant-analysis/shared/variant-analysis";

export default {
  title: "Model Alerts/Model Alerts Header",
  component: ModelAlertsHeaderComponent,
} as Meta<typeof ModelAlertsHeaderComponent>;

const Template: StoryFn<typeof ModelAlertsHeaderComponent> = (args) => (
  <ModelAlertsHeaderComponent {...args} />
);

export const ModelAlertsHeader = Template.bind({});
ModelAlertsHeader.args = {
  viewState: { title: "codeql/sql2o-models" },
  variantAnalysis: createMockVariantAnalysis({}),
  openModelPackClick: (path: string) => {},
};
