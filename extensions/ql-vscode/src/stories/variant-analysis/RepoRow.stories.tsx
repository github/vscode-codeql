import React from 'react';

import { ComponentMeta, ComponentStory } from '@storybook/react';

import { VariantAnalysisContainer } from '../../view/variant-analysis/VariantAnalysisContainer';
import { VariantAnalysisRepoStatus } from '../../remote-queries/shared/variant-analysis';
import { AnalysisAlert, AnalysisRawResults } from '../../remote-queries/shared/analysis-result';

import analysesResults from '../remote-queries/data/analysesResultsMessage.json';
import rawResults from '../remote-queries/data/rawResults.json';
import { RepoRow } from '../../view/variant-analysis/RepoRow';

export default {
  title: 'Variant Analysis/Repo Row',
  component: RepoRow,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    )
  ],
} as ComponentMeta<typeof RepoRow>;

const Template: ComponentStory<typeof RepoRow> = (args) => (
  <RepoRow {...args} />
);

export const Pending = Template.bind({});
Pending.args = {
  repository: {
    id: 63537249,
    fullName: 'facebook/create-react-app',
    private: false,
  },
  status: VariantAnalysisRepoStatus.Pending,
};

export const InProgress = Template.bind({});
InProgress.args = {
  ...Pending.args,
  status: VariantAnalysisRepoStatus.InProgress,
  interpretedResults: undefined,
};

export const Failed = Template.bind({});
Failed.args = {
  ...Pending.args,
  status: VariantAnalysisRepoStatus.Failed,
  interpretedResults: undefined,
};

export const TimedOut = Template.bind({});
TimedOut.args = {
  ...Pending.args,
  status: VariantAnalysisRepoStatus.TimedOut,
};

export const Canceled = Template.bind({});
Canceled.args = {
  ...Pending.args,
  status: VariantAnalysisRepoStatus.Canceled,
};

export const InterpretedResults = Template.bind({});
InterpretedResults.args = {
  ...Pending.args,
  status: VariantAnalysisRepoStatus.Succeeded,
  resultCount: 198,
  interpretedResults: analysesResults.analysesResults.find(v => v.nwo === 'facebook/create-react-app')?.interpretedResults as unknown as AnalysisAlert[],
};

export const RawResults = Template.bind({});
RawResults.args = {
  ...InterpretedResults.args,
  interpretedResults: undefined,
  resultCount: 1,
  rawResults: rawResults as unknown as AnalysisRawResults,
};

export const SkippedOnlyFullName = Template.bind({});
SkippedOnlyFullName.args = {
  repository: {
    fullName: 'octodemo/hello-globe',
  }
};

export const SkippedPublic = Template.bind({});
SkippedPublic.args = {
  repository: {
    fullName: 'octodemo/hello-globe',
    private: false,
  }
};

export const SkippedPrivate = Template.bind({});
SkippedPrivate.args = {
  repository: {
    fullName: 'octodemo/hello-globe',
    private: true,
  }
};
