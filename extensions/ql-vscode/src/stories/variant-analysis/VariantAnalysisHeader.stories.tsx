import React from 'react';

import { ComponentStory, ComponentMeta } from '@storybook/react';

import { VariantAnalysisContainer } from '../../view/variant-analysis/VariantAnalysisContainer';
import { VariantAnalysisHeader } from '../../view/variant-analysis/VariantAnalysisHeader';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';

export default {
  title: 'Variant Analysis Header',
  component: VariantAnalysisHeader,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    )
  ],
  argTypes: {
    onOpenQueryClick: {
      action: 'open-query-clicked',
      table: {
        disable: true,
      },
    },
    onViewQueryClick: {
      action: 'view-query-clicked',
      table: {
        disable: true,
      },
    },
    onStopQueryClick: {
      action: 'stop-query-clicked',
      table: {
        disable: true,
      },
    },
    onCopyRepositoryListClick: {
      action: 'copy-repository-list-clicked',
      table: {
        disable: true,
      },
    },
    onExportResultsClick: {
      action: 'export-results-clicked',
      table: {
        disable: true,
      },
    },
  }
} as ComponentMeta<typeof VariantAnalysisHeader>;

const Template: ComponentStory<typeof VariantAnalysisHeader> = (args) => (
  <VariantAnalysisHeader {...args} />
);

export const InProgress = Template.bind({});
InProgress.args = {
  queryName: 'Query name',
  queryFileName: 'example.ql',
  status: VariantAnalysisStatus.InProgress,
};

export const Succeeded = Template.bind({});
Succeeded.args = {
  ...InProgress.args,
  status: VariantAnalysisStatus.Succeeded,
};

export const Failed = Template.bind({});
Failed.args = {
  ...InProgress.args,
  status: VariantAnalysisStatus.Failed,
};
