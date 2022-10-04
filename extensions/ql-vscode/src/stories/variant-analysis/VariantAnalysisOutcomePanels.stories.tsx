import React from 'react';

import { ComponentMeta, ComponentStory } from '@storybook/react';

import { VariantAnalysisContainer } from '../../view/variant-analysis/VariantAnalysisContainer';
import { VariantAnalysisOutcomePanels } from '../../view/variant-analysis/VariantAnalysisOutcomePanels';
import {
  VariantAnalysis,
  VariantAnalysisQueryLanguage,
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository,
  VariantAnalysisStatus
} from '../../remote-queries/shared/variant-analysis';

export default {
  title: 'Variant Analysis/Variant Analysis Outcome Panels',
  component: VariantAnalysisOutcomePanels,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    )
  ],
} as ComponentMeta<typeof VariantAnalysisOutcomePanels>;

const Template: ComponentStory<typeof VariantAnalysisOutcomePanels> = (args) => (
  <VariantAnalysisOutcomePanels {...args} />
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

export const WithoutSkippedRepos = Template.bind({});
WithoutSkippedRepos.args = {
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

export const WithSkippedRepos = Template.bind({});
WithSkippedRepos.args = {
  ...WithoutSkippedRepos.args,
  variantAnalysis: buildVariantAnalysis({
    ...WithoutSkippedRepos.args.variantAnalysis,
    skippedRepos: {
      notFoundRepos: {
        repositoryCount: 2,
        repositories: [
          {
            fullName: 'octodemo/hello-globe'
          },
          {
            fullName: 'octodemo/hello-planet'
          }
        ]
      },
      noCodeqlDbRepos: {
        repositoryCount: 4,
        repositories: [
          {
            id: 100,
            fullName: 'octodemo/no-db-1'
          },
          {
            id: 101,
            fullName: 'octodemo/no-db-2'
          },
          {
            id: 102,
            fullName: 'octodemo/no-db-3'
          },
          {
            id: 103,
            fullName: 'octodemo/no-db-4'
          }
        ]
      },
      overLimitRepos: {
        repositoryCount: 1,
        repositories: [
          {
            id: 201,
            fullName: 'octodemo/over-limit-1'
          }
        ]
      },
      accessMismatchRepos: {
        repositoryCount: 1,
        repositories: [
          {
            id: 205,
            fullName: 'octodemo/private'
          }
        ]
      }
    },
  }),
};

export const WithOnlyWarningsSkippedRepos = Template.bind({});
WithOnlyWarningsSkippedRepos.args = {
  ...WithoutSkippedRepos.args,
  variantAnalysis: buildVariantAnalysis({
    ...WithSkippedRepos.args.variantAnalysis,
    skippedRepos: {
      ...WithSkippedRepos.args.variantAnalysis?.skippedRepos,
      notFoundRepos: undefined,
      noCodeqlDbRepos: undefined,
    }
  }),
};
