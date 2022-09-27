import React from 'react';

import { ComponentMeta, ComponentStory } from '@storybook/react';

import { VariantAnalysisContainer } from '../../view/variant-analysis/VariantAnalysisContainer';
import { VariantAnalysisAnalyzedRepos } from '../../view/variant-analysis/VariantAnalysisAnalyzedRepos';
import {
  VariantAnalysisQueryLanguage,
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus
} from '../../remote-queries/shared/variant-analysis';
import { AnalysisAlert } from '../../remote-queries/shared/analysis-result';

import analysesResults from '../remote-queries/data/analysesResultsMessage.json';

export default {
  title: 'Variant Analysis/Analyzed Repos',
  component: VariantAnalysisAnalyzedRepos,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    )
  ],
} as ComponentMeta<typeof VariantAnalysisAnalyzedRepos>;

const Template: ComponentStory<typeof VariantAnalysisAnalyzedRepos> = (args) => (
  <VariantAnalysisAnalyzedRepos {...args} />
);

const interpretedResultsForRepo = (nwo: string): AnalysisAlert[] | undefined => {
  return analysesResults.analysesResults.find(v => v.nwo === nwo)?.interpretedResults as unknown as AnalysisAlert[];
};

export const Example = Template.bind({});
Example.args = {
  variantAnalysis: {
    id: 1,
    controllerRepoId: 1,
    query: {
      name: 'Query name',
      filePath: 'example.ql',
      language: VariantAnalysisQueryLanguage.Javascript,
    },
    databases: {},
    status: VariantAnalysisStatus.InProgress,
    scannedRepos: [
      {
        repository: {
          id: 63537249,
          fullName: 'facebook/create-react-app',
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Succeeded, resultCount: 198,
      },
      {
        repository: {
          id: 167174,
          fullName: 'jquery/jquery',
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 67,
      },
      {
        repository: {
          id: 237159,
          fullName: 'expressjs/express',
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 26,
      },
      {
        repository: {
          id: 15062869,
          fullName: 'facebook/jest',
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Failed,
      },
      {
        repository: {
          id: 24195339,
          fullName: 'angular/angular',
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.InProgress,
      },
      {
        repository: {
          id: 24560307,
          fullName: 'babel/babel',
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Pending,
      },
    ]
  },
  repositoryResults: [
    {
      repositoryId: 63537249,
      interpretedResults: interpretedResultsForRepo('facebook/create-react-app'),
    },
    {
      repositoryId: 167174,
      interpretedResults: interpretedResultsForRepo('jquery/jquery'),
    },
    {
      repositoryId: 237159,
      interpretedResults: interpretedResultsForRepo('expressjs/express'),
    }
  ]
}
  ;
