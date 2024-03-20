import type { Meta, StoryFn } from "@storybook/react";

import AnalysisAlertResult from "../../view/variant-analysis/AnalysisAlertResult";
import type { AnalysisAlert } from "../../variant-analysis/shared/analysis-result";
import { createMockAnalysisAlert } from "../../../test/factories/variant-analysis/shared/analysis-alert";

export default {
  title: "Variant Analysis/Analysis Alert Result",
  component: AnalysisAlertResult,
} as Meta<typeof AnalysisAlertResult>;

const Template: StoryFn<typeof AnalysisAlertResult> = (args) => (
  <AnalysisAlertResult {...args} />
);

export const Warning = Template.bind({});

const warningAlert: AnalysisAlert = createMockAnalysisAlert();

Warning.args = {
  alert: warningAlert,
};
