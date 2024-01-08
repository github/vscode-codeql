import type { Meta, StoryFn } from "@storybook/react";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import { VariantAnalysisStats } from "../../view/variant-analysis/VariantAnalysisStats";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";

export default {
  title: "Variant Analysis/Variant Analysis Stats",
  component: VariantAnalysisStats,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    ),
  ],
  argTypes: {
    onViewLogsClick: {
      action: "view-logs-clicked",
      table: {
        disable: true,
      },
    },
  },
} as Meta<typeof VariantAnalysisStats>;

const Template: StoryFn<typeof VariantAnalysisStats> = (args) => (
  <VariantAnalysisStats {...args} />
);

export const Starting = Template.bind({});
Starting.args = {
  variantAnalysisStatus: VariantAnalysisStatus.InProgress,
  totalRepositoryCount: 10,
  completedRepositoryCount: 0,
  successfulRepositoryCount: 0,
  skippedRepositoryCount: 0,
};

export const Started = Template.bind({});
Started.args = {
  ...Starting.args,
  resultCount: 99_999,
  completedRepositoryCount: 2,
  successfulRepositoryCount: 2,
};

export const StartedWithSkippedRepositories = Template.bind({});
StartedWithSkippedRepositories.args = {
  ...Starting.args,
  skippedRepositoryCount: 3,
};

export const StartedWithFailedAnalyses = Template.bind({});
StartedWithFailedAnalyses.args = {
  ...Starting.args,
  completedRepositoryCount: 5,
  successfulRepositoryCount: 3,
};

export const Succeeded = Template.bind({});
Succeeded.args = {
  ...Started.args,
  totalRepositoryCount: 1000,
  completedRepositoryCount: 1000,
  successfulRepositoryCount: 1000,
  variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
  createdAt: new Date(1661262726000),
  completedAt: new Date(1661263446000),
};

export const SucceededWithSkippedRepositories = Template.bind({});
SucceededWithSkippedRepositories.args = {
  ...Succeeded.args,
  totalRepositoryCount: 10,
  completedRepositoryCount: 10,
  successfulRepositoryCount: 10,
  skippedRepositoryCount: 6,
};

export const SucceededWithFailedAnalyses = Template.bind({});
SucceededWithFailedAnalyses.args = {
  ...Succeeded.args,
  totalRepositoryCount: 10,
  completedRepositoryCount: 10,
  successfulRepositoryCount: 7,
};

export const SucceededWithFailedAnalysesAndSkippedRepositories = Template.bind(
  {},
);
SucceededWithFailedAnalysesAndSkippedRepositories.args = {
  ...SucceededWithFailedAnalyses.args,
  skippedRepositoryCount: 6,
};

export const Failed = Template.bind({});
Failed.args = {
  ...Starting.args,
  variantAnalysisStatus: VariantAnalysisStatus.Failed,
  createdAt: new Date(1661263436000),
  completedAt: new Date(1661263446000),
};

export const Stopped = Template.bind({});
Stopped.args = {
  ...Started.args,
  variantAnalysisStatus: VariantAnalysisStatus.Canceled,
  completedRepositoryCount: 10,
};
