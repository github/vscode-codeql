import type { Meta, StoryFn } from "@storybook/react";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepositoryDownloadStatus,
} from "../../variant-analysis/shared/variant-analysis";
import type {
  AnalysisAlert,
  AnalysisRawResults,
} from "../../variant-analysis/shared/analysis-result";
import { createMockRepositoryWithMetadata } from "../../../test/factories/variant-analysis/shared/repository";

import { analysesResults } from "../data/analysesResultsMessage.json";
// eslint-disable-next-line import/no-namespace -- We need the full JSON object, so we can't use named imports
import * as rawResults from "../data/rawResults.json";
import type { RepoRowProps } from "../../view/variant-analysis/RepoRow";
import { RepoRow } from "../../view/variant-analysis/RepoRow";

export default {
  title: "Variant Analysis/Repo Row",
  component: RepoRow,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    ),
  ],
} as Meta<typeof RepoRow>;

const Template: StoryFn<typeof RepoRow> = (args: RepoRowProps) => (
  <RepoRow {...args} />
);

export const Pending = Template.bind({});
Pending.args = {
  repository: {
    ...createMockRepositoryWithMetadata(),
    id: 63537249,
    fullName: "facebook/create-react-app",
    private: false,
    stargazersCount: 97_761,
    updatedAt: "2022-11-01T13:07:05Z",
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

export const SucceededDownloading = Template.bind({});
SucceededDownloading.args = {
  ...Pending.args,
  status: VariantAnalysisRepoStatus.Succeeded,
  resultCount: 198,
  downloadState: {
    repositoryId: 63537249,
    downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
  },
};

export const SucceededDownloadingWithPercentage = Template.bind({});
SucceededDownloadingWithPercentage.args = {
  ...Pending.args,
  status: VariantAnalysisRepoStatus.Succeeded,
  resultCount: 198,
  downloadState: {
    repositoryId: 63537249,
    downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
    downloadPercentage: 42,
  },
};

export const SucceededSuccessfulDownload = Template.bind({});
SucceededSuccessfulDownload.args = {
  ...Pending.args,
  status: VariantAnalysisRepoStatus.Succeeded,
  resultCount: 198,
  downloadState: {
    repositoryId: 63537249,
    downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
  },
};

export const SucceededFailedDownload = Template.bind({});
SucceededFailedDownload.args = {
  ...Pending.args,
  status: VariantAnalysisRepoStatus.Succeeded,
  resultCount: 198,
  downloadState: {
    repositoryId: 63537249,
    downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Failed,
  },
};

export const InterpretedResults = Template.bind({});
InterpretedResults.args = {
  ...Pending.args,
  status: VariantAnalysisRepoStatus.Succeeded,
  resultCount: 198,
  interpretedResults: analysesResults.find(
    (v) => v.nwo === "facebook/create-react-app",
  )?.interpretedResults as AnalysisAlert[],
};

export const RawResults = Template.bind({});
RawResults.args = {
  ...InterpretedResults.args,
  interpretedResults: undefined,
  resultCount: 1,
  rawResults: rawResults as AnalysisRawResults,
};

export const SkippedOnlyFullName = Template.bind({});
SkippedOnlyFullName.args = {
  repository: {
    fullName: "octodemo/hello-globe",
  },
};

export const SkippedPublic = Template.bind({});
SkippedPublic.args = {
  repository: {
    ...createMockRepositoryWithMetadata(),
    fullName: "octodemo/hello-globe",
    private: false,
    stargazersCount: 83_372,
    updatedAt: "2022-10-28T14:10:35Z",
  },
};

export const SkippedPrivate = Template.bind({});
SkippedPrivate.args = {
  repository: {
    ...createMockRepositoryWithMetadata(),
    fullName: "octodemo/hello-globe",
    private: true,
    stargazersCount: 83_372,
    updatedAt: "2022-05-28T14:10:35Z",
  },
};
