import type { Meta, StoryFn } from "@storybook/react";

import { faker } from "@faker-js/faker";
import { customAlphabet } from "nanoid";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import { VariantAnalysisAnalyzedRepos } from "../../view/variant-analysis/VariantAnalysisAnalyzedRepos";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisStatus,
} from "../../variant-analysis/shared/variant-analysis";
import type { AnalysisAlert } from "../../variant-analysis/shared/analysis-result";
import { createMockVariantAnalysis } from "../../../test/factories/variant-analysis/shared/variant-analysis";
import { createMockRepositoryWithMetadata } from "../../../test/factories/variant-analysis/shared/repository";
import { createMockScannedRepo } from "../../../test/factories/variant-analysis/shared/scanned-repositories";

import { analysesResults } from "../data/analysesResultsMessage.json";

export default {
  title: "Variant Analysis/Analyzed Repos",
  component: VariantAnalysisAnalyzedRepos,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    ),
  ],
} as Meta<typeof VariantAnalysisAnalyzedRepos>;

const Template: StoryFn<typeof VariantAnalysisAnalyzedRepos> = (args) => (
  <VariantAnalysisAnalyzedRepos {...args} />
);

const interpretedResultsForRepo = (
  nwo: string,
): AnalysisAlert[] | undefined => {
  return analysesResults.find((v) => v.nwo === nwo)
    ?.interpretedResults as AnalysisAlert[];
};

export const Example = Template.bind({});
Example.args = {
  variantAnalysis: createMockVariantAnalysis({
    status: VariantAnalysisStatus.InProgress,
    scannedRepos: [
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 63537249,
          fullName: "facebook/create-react-app",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 198,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 167174,
          fullName: "jquery/jquery",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 67,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 237159,
          fullName: "expressjs/express",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 26,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 15062869,
          fullName: "facebook/jest",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Failed,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 24195339,
          fullName: "angular/angular",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.InProgress,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 24560307,
          fullName: "babel/babel",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Pending,
      },
    ],
  }),
  repositoryResults: [
    {
      variantAnalysisId: 1,
      repositoryId: 63537249,
      interpretedResults: interpretedResultsForRepo(
        "facebook/create-react-app",
      ),
    },
    {
      variantAnalysisId: 1,
      repositoryId: 167174,
      interpretedResults: interpretedResultsForRepo("jquery/jquery"),
    },
    {
      variantAnalysisId: 1,
      repositoryId: 237159,
      interpretedResults: interpretedResultsForRepo("expressjs/express"),
    },
  ],
};

faker.seed(42);

const manyScannedRepos = Array.from({ length: 1000 }, (_, i) => {
  const mockedScannedRepo = createMockScannedRepo();
  const nanoid = customAlphabet("123456789");
  return {
    ...mockedScannedRepo,
    analysisStatus: VariantAnalysisRepoStatus.Succeeded,
    resultCount: faker.number.int({ min: 0, max: 1000 }),
    repository: {
      ...mockedScannedRepo.repository,
      // We need to ensure the ID is unique for React keys
      id: parseInt(nanoid()),
      fullName: `octodemo/${nanoid()}`,
    },
  };
});

export const ManyRepositoriesPerformanceExample = Template.bind({});
ManyRepositoriesPerformanceExample.args = {
  variantAnalysis: {
    ...createMockVariantAnalysis({
      status: VariantAnalysisStatus.Succeeded,
      scannedRepos: manyScannedRepos,
    }),
    id: 1,
  },
  repositoryResults: manyScannedRepos.map((repoTask) => ({
    variantAnalysisId: 1,
    repositoryId: repoTask.repository.id,
    interpretedResults: interpretedResultsForRepo("facebook/create-react-app"),
  })),
};

const mockAnalysisAlert = interpretedResultsForRepo(
  "facebook/create-react-app",
)![0];

const performanceNumbers = [10, 50, 100, 500, 1000, 2000, 5000, 10_000];

export const ManyResultsPerformanceExample = Template.bind({});
ManyResultsPerformanceExample.args = {
  variantAnalysis: {
    ...createMockVariantAnalysis({
      status: VariantAnalysisStatus.Succeeded,
      scannedRepos: performanceNumbers.map((resultCount, i) => ({
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: resultCount,
          fullName: `octodemo/${i}-${resultCount}-results`,
        },
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount,
      })),
    }),
    id: 1,
  },
  repositoryStates: performanceNumbers.map((resultCount) => ({
    repositoryId: resultCount,
    downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
  })),
  repositoryResults: performanceNumbers.map((resultCount) => ({
    variantAnalysisId: 1,
    repositoryId: resultCount,
    interpretedResults: Array.from({ length: resultCount }, (_, i) => ({
      ...mockAnalysisAlert,
    })),
  })),
};
