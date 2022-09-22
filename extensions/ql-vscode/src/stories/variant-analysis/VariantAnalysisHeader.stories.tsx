import React from 'react';

import { ComponentStory, ComponentMeta } from '@storybook/react';

import { VariantAnalysisContainer } from '../../view/variant-analysis/VariantAnalysisContainer';
import { VariantAnalysisHeader } from '../../view/variant-analysis/VariantAnalysisHeader';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';

export default {
  title: 'Variant Analysis/Variant Analysis Header',
  component: VariantAnalysisHeader,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    )
  ],
  argTypes: {
    onOpenQueryFileClick: {
      action: 'open-query-file-clicked',
      table: {
        disable: true,
      },
    },
    onViewQueryTextClick: {
      action: 'view-query-text-clicked',
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
    onViewLogsClick: {
      action: 'view-logs-clicked',
      table: {
        disable: true,
      }
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
  variantAnalysisStatus: VariantAnalysisStatus.InProgress,
  totalRepositoryCount: 10,
  completedRepositoryCount: 2,
  resultCount: 99_999,
};

export const Succeeded = Template.bind({});
Succeeded.args = {
  ...InProgress.args,
  variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
  totalRepositoryCount: 1000,
  completedRepositoryCount: 1000,
  duration: 720_000,
  completedAt: new Date(1661263446000),
};

export const Failed = Template.bind({});
Failed.args = {
  ...InProgress.args,
  variantAnalysisStatus: VariantAnalysisStatus.Failed,
  duration: 10_000,
  completedAt: new Date(1661263446000),
};
