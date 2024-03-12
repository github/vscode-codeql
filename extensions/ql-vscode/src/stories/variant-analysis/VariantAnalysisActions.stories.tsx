import type { Meta, StoryFn } from "@storybook/react";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";
import { VariantAnalysisActions } from "../../view/variant-analysis/VariantAnalysisActions";

export default {
  title: "Variant Analysis/Variant Analysis Actions",
  component: VariantAnalysisActions,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    ),
  ],
  argTypes: {
    onStopQueryClick: {
      action: "stop-query-clicked",
      table: {
        disable: true,
      },
    },
    onCopyRepositoryListClick: {
      action: "copy-repository-list-clicked",
      table: {
        disable: true,
      },
    },
    onExportResultsClick: {
      action: "export-results-clicked",
      table: {
        disable: true,
      },
    },
  },
} as Meta<typeof VariantAnalysisActions>;

const Template: StoryFn<typeof VariantAnalysisActions> = (args) => (
  <VariantAnalysisActions {...args} />
);

export const InProgress = Template.bind({});
InProgress.args = {
  variantAnalysisStatus: VariantAnalysisStatus.InProgress,
};

export const InProgressWithResults = Template.bind({});
InProgressWithResults.args = {
  variantAnalysisStatus: VariantAnalysisStatus.InProgress,
  showResultActions: true,
};

export const InProgressWithoutDownloadedRepos = Template.bind({});
InProgressWithoutDownloadedRepos.args = {
  variantAnalysisStatus: VariantAnalysisStatus.InProgress,
  showResultActions: true,
  exportResultsDisabled: true,
};

export const Succeeded = Template.bind({});
Succeeded.args = {
  ...InProgress.args,
  variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
  showResultActions: true,
};

export const Failed = Template.bind({});
Failed.args = {
  ...InProgress.args,
  variantAnalysisStatus: VariantAnalysisStatus.Failed,
};

export const Canceling = Template.bind({});
Canceling.args = {
  ...InProgress.args,
  variantAnalysisStatus: VariantAnalysisStatus.Canceling,
};
