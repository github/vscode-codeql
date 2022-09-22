import React from 'react';

import { ComponentMeta, ComponentStory } from '@storybook/react';

import { VariantAnalysisContainer } from '../../view/variant-analysis/VariantAnalysisContainer';
import { VariantAnalysisHeader } from '../../view/variant-analysis/VariantAnalysisHeader';
import {
  VariantAnalysis,
  VariantAnalysisQueryLanguage,
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository,
  VariantAnalysisStatus
} from '../../remote-queries/shared/variant-analysis';

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

const buildVariantAnalysis = (data: Partial<VariantAnalysis>) => ({
  id: 1,
  controllerRepoId: 1,
  query: {
    name: 'Query name',
    filePath: 'example.ql',
    language: VariantAnalysisQueryLanguage.Javascript,
  },
  databases: {},
  status: VariantAnalysisStatus.InProgress,
  ...data,
});

const buildScannedRepo = (id: number, data?: Partial<VariantAnalysisScannedRepository>): VariantAnalysisScannedRepository => ({
  repository: {
    id: id,
    fullName: `octodemo/hello-world-${id}`,
    private: false,
  },
  analysisStatus: VariantAnalysisRepoStatus.Pending,
  ...data,
});

export const InProgress = Template.bind({});
InProgress.args = {
  variantAnalysis: buildVariantAnalysis({
    scannedRepos: [
      buildScannedRepo(1, {
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 99_999,
      }),
      buildScannedRepo(2, {
        analysisStatus: VariantAnalysisRepoStatus.Failed,
      }),
      buildScannedRepo(3, {
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 0,
      }),
      buildScannedRepo(4),
      buildScannedRepo(5),
      buildScannedRepo(6),
      buildScannedRepo(7),
      buildScannedRepo(8),
      buildScannedRepo(9),
      buildScannedRepo(10),
    ]
  }),
};

export const Succeeded = Template.bind({});
Succeeded.args = {
  ...InProgress.args,
  variantAnalysis: buildVariantAnalysis({
    status: VariantAnalysisStatus.Succeeded,
    scannedRepos: Array.from({ length: 1000 }, (_, i) => buildScannedRepo(i + 1, {
      analysisStatus: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 100,
    }))
  }),
  duration: 720_000,
  completedAt: new Date(1661263446000),
};

export const Failed = Template.bind({});
Failed.args = {
  ...InProgress.args,
  variantAnalysis: buildVariantAnalysis({
    status: VariantAnalysisStatus.Failed,
  }),
  duration: 10_000,
  completedAt: new Date(1661263446000),
};
