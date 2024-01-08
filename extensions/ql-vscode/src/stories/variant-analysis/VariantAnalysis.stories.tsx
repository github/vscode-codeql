import type { Meta, StoryFn } from "@storybook/react";

import { VariantAnalysis as VariantAnalysisComponent } from "../../view/variant-analysis/VariantAnalysis";
import type {
  VariantAnalysis as VariantAnalysisDomainModel,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from "../../variant-analysis/shared/variant-analysis";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisStatus,
} from "../../variant-analysis/shared/variant-analysis";
import { createMockVariantAnalysis } from "../../../test/factories/variant-analysis/shared/variant-analysis";
import { createMockRepositoryWithMetadata } from "../../../test/factories/variant-analysis/shared/repository";
import { ColumnKind } from "../../common/raw-result-types";

export default {
  title: "Variant Analysis/Variant Analysis",
  component: VariantAnalysisComponent,
} as Meta<typeof VariantAnalysisComponent>;

const Template: StoryFn<typeof VariantAnalysisComponent> = (args) => (
  <VariantAnalysisComponent {...args} />
);

const variantAnalysis: VariantAnalysisDomainModel = {
  ...createMockVariantAnalysis({ status: VariantAnalysisStatus.InProgress }),
  controllerRepo: {
    id: 1,
    fullName: "octodemo/variant-analysis-controller",
    private: false,
  },
  actionsWorkflowRunId: 789263,
  databases: {},
  status: VariantAnalysisStatus.InProgress,
  scannedRepos: [
    {
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 1,
        fullName: "octodemo/hello-world-1",
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 100,
    },
    {
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 2,
        fullName: "octodemo/hello-world-2",
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Succeeded,
    },
    {
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 3,
        fullName: "octodemo/hello-world-3",
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Succeeded,
    },
    {
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 4,
        fullName: "octodemo/hello-world-4",
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 5,
        fullName: "octodemo/hello-world-5",
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Failed,
    },
    {
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 6,
        fullName: "octodemo/hello-world-6",
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.InProgress,
    },
    {
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 7,
        fullName: "octodemo/hello-world-7",
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 8,
        fullName: "octodemo/hello-world-8",
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 9,
        fullName: "octodemo/hello-world-9",
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 10,
        fullName: "octodemo/hello-world-10",
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
  ],
  skippedRepos: {
    notFoundRepos: {
      repositoryCount: 2,
      repositories: [
        {
          fullName: "octodemo/hello-globe",
        },
        {
          fullName: "octodemo/hello-planet",
        },
      ],
    },
    noCodeqlDbRepos: {
      repositoryCount: 4,
      repositories: [
        {
          ...createMockRepositoryWithMetadata(),
          id: 100,
          fullName: "octodemo/no-db-1",
        },
        {
          ...createMockRepositoryWithMetadata(),
          id: 101,
          fullName: "octodemo/no-db-2",
        },
        {
          ...createMockRepositoryWithMetadata(),
          id: 102,
          fullName: "octodemo/no-db-3",
        },
        {
          ...createMockRepositoryWithMetadata(),
          id: 103,
          fullName: "octodemo/no-db-4",
        },
      ],
    },
    overLimitRepos: {
      repositoryCount: 1,
      repositories: [
        {
          ...createMockRepositoryWithMetadata(),
          id: 201,
          fullName: "octodemo/over-limit-1",
        },
      ],
    },
    accessMismatchRepos: {
      repositoryCount: 1,
      repositories: [
        {
          ...createMockRepositoryWithMetadata(),
          id: 205,
          fullName: "octodemo/private",
        },
      ],
    },
  },
};

const repoStates: VariantAnalysisScannedRepositoryState[] = [
  {
    repositoryId: 1,
    downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
  },
  {
    repositoryId: 2,
    downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
  },
  {
    repositoryId: 3,
    downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Failed,
  },
];

const repoResults: VariantAnalysisScannedRepositoryResult[] = [
  {
    variantAnalysisId: 1,
    repositoryId: 1,
    rawResults: {
      resultSet: {
        name: "#select",
        totalRowCount: 1,
        columns: [
          {
            kind: ColumnKind.Integer,
          },
        ],
        rows: [
          [
            {
              type: "number",
              value: 60688,
            },
          ],
        ],
      },
      fileLinkPrefix:
        "https://github.com/octodemo/hello-world-1/blob/59a2a6c7d9dde7a6ecb77c2f7e8197d6925c143b",
      sourceLocationPrefix: "/home/runner/work/bulk-builder/bulk-builder",
      capped: false,
    },
  },
];

export const Loading = Template.bind({});
Loading.args = {};

export const FullExample = Template.bind({});
FullExample.args = {
  variantAnalysis,
  repoStates,
  repoResults,
};

export const FullExampleWithoutSkipped = Template.bind({});
FullExampleWithoutSkipped.args = {
  variantAnalysis: {
    ...variantAnalysis,
    skippedRepos: {},
  },
  repoStates,
  repoResults,
};

export const Canceled = Template.bind({});
Canceled.args = {
  variantAnalysis: {
    ...variantAnalysis,
    status: VariantAnalysisStatus.Canceled,
    completedAt: new Date(
      new Date(variantAnalysis.createdAt).getTime() + 100_000,
    ).toISOString(),
    scannedRepos: [
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 1,
          fullName: "octodemo/hello-world-1",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 200,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 2,
          fullName: "octodemo/hello-world-2",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 10_000,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 3,
          fullName: "octodemo/hello-world-3",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 500,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 4,
          fullName: "octodemo/hello-world-4",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Canceled,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 5,
          fullName: "octodemo/hello-world-5",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Failed,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 6,
          fullName: "octodemo/hello-world-6",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Canceled,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 7,
          fullName: "octodemo/hello-world-7",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Canceled,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 8,
          fullName: "octodemo/hello-world-8",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Canceled,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 9,
          fullName: "octodemo/hello-world-9",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Canceled,
      },
      {
        repository: {
          ...createMockRepositoryWithMetadata(),
          id: 10,
          fullName: "octodemo/hello-world-10",
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Canceled,
      },
    ],
  },
  repoStates,
  repoResults,
};

export const Failed = Template.bind({});
Failed.args = {
  variantAnalysis: {
    ...variantAnalysis,
    status: VariantAnalysisStatus.Failed,
    failureReason: VariantAnalysisFailureReason.NoReposQueried,
    completedAt: new Date(
      new Date(variantAnalysis.createdAt).getTime() + 100_000,
    ).toISOString(),
    scannedRepos: [],
    skippedRepos: {
      ...variantAnalysis.skippedRepos,
      overLimitRepos: {
        repositoryCount: 0,
        repositories: [],
      },
    },
  },
  repoStates,
  repoResults,
};

export const FailedInternal = Template.bind({});
FailedInternal.args = {
  variantAnalysis: {
    ...variantAnalysis,
    status: VariantAnalysisStatus.Failed,
    failureReason: VariantAnalysisFailureReason.InternalError,
    completedAt: new Date(
      new Date(variantAnalysis.createdAt).getTime() + 100_000,
    ).toISOString(),
    scannedRepos: [],
    skippedRepos: {},
  },
  repoStates,
  repoResults,
};
