import React from "react";

import { ComponentMeta, ComponentStory } from "@storybook/react";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import { VariantAnalysisStatus } from "../../remote-queries/shared/variant-analysis";
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
} as ComponentMeta<typeof VariantAnalysisActions>;

const Template: ComponentStory<typeof VariantAnalysisActions> = (args) => (
  <VariantAnalysisActions {...args} />
);

export const InProgress = Template.bind({});
InProgress.args = {
  variantAnalysisStatus: VariantAnalysisStatus.InProgress,
};

export const Succeeded = Template.bind({});
Succeeded.args = {
  ...InProgress.args,
  variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
};

export const Failed = Template.bind({});
Failed.args = {
  ...InProgress.args,
  variantAnalysisStatus: VariantAnalysisStatus.Failed,
};
