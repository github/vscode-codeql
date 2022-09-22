import React from 'react';

import { ComponentStory, ComponentMeta } from '@storybook/react';

import { VariantAnalysisContainer } from '../../view/variant-analysis/VariantAnalysisContainer';
import { VariantAnalysisStats } from '../../view/variant-analysis/VariantAnalysisStats';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';

export default {
  title: 'Variant Analysis/Variant Analysis Stats',
  component: VariantAnalysisStats,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    )
  ],
  argTypes: {
    onViewLogsClick: {
      action: 'view-logs-clicked',
      table: {
        disable: true,
      },
    },
  }
} as ComponentMeta<typeof VariantAnalysisStats>;

const Template: ComponentStory<typeof VariantAnalysisStats> = (args) => (
  <VariantAnalysisStats {...args} />
);

export const Starting = Template.bind({});
Starting.args = {
  variantAnalysisStatus: VariantAnalysisStatus.InProgress,
  totalRepositoryCount: 10,
};

export const Started = Template.bind({});
Started.args = {
  ...Starting.args,
  resultCount: 99_999,
  completedRepositoryCount: 2,
};

export const StartedWithWarnings = Template.bind({});
StartedWithWarnings.args = {
  ...Starting.args,
  queryResult: 'warning',
};

export const Succeeded = Template.bind({});
Succeeded.args = {
  ...Started.args,
  totalRepositoryCount: 1000,
  completedRepositoryCount: 1000,
  variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
  duration: 720_000,
  completedAt: new Date(1661263446000),
};

export const SucceededWithWarnings = Template.bind({});
SucceededWithWarnings.args = {
  ...Succeeded.args,
  totalRepositoryCount: 10,
  completedRepositoryCount: 2,
  queryResult: 'warning',
};

export const Failed = Template.bind({});
Failed.args = {
  ...Starting.args,
  variantAnalysisStatus: VariantAnalysisStatus.Failed,
  duration: 10_000,
  completedAt: new Date(1661263446000),
};

export const Stopped = Template.bind({});
Stopped.args = {
  ...SucceededWithWarnings.args,
  queryResult: 'stopped',
};
