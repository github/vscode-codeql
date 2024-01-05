import type { Meta, StoryFn } from "@storybook/react";
import { VariantAnalysisFailureReason } from "../../variant-analysis/shared/variant-analysis";
import { FailureReasonAlert } from "../../view/variant-analysis/FailureReasonAlert";

export default {
  title: "Variant Analysis/Failure reason alert",
  component: FailureReasonAlert,
} as Meta<typeof FailureReasonAlert>;

const Template: StoryFn<typeof FailureReasonAlert> = (args) => (
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
