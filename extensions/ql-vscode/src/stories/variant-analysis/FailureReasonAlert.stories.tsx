import * as React from "react";

import { ComponentMeta, ComponentStory } from "@storybook/react";
import { VariantAnalysisFailureReason } from "../../remote-queries/shared/variant-analysis";
import { FailureReasonAlert } from "../../view/variant-analysis/FailureReasonAlert";

export default {
  title: "Variant Analysis/Failure reason alert",
  component: FailureReasonAlert,
} as ComponentMeta<typeof FailureReasonAlert>;

const Template: ComponentStory<typeof FailureReasonAlert> = (args) => (
  <FailureReasonAlert {...args} />
);

export const NoReposQueried = Template.bind({});
NoReposQueried.args = {
  failureReason: VariantAnalysisFailureReason.NoReposQueried,
};

export const ActionsWorkflowRunFailed = Template.bind({});
ActionsWorkflowRunFailed.args = {
  failureReason: VariantAnalysisFailureReason.ActionsWorkflowRunFailed,
};

export const InternalError = Template.bind({});
InternalError.args = {
  failureReason: VariantAnalysisFailureReason.InternalError,
};
