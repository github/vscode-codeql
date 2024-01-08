import { useState } from "react";

import type { Meta, StoryFn } from "@storybook/react";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import { VariantAnalysisOutcomePanels } from "../../view/variant-analysis/VariantAnalysisOutcomePanels";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus,
} from "../../variant-analysis/shared/variant-analysis";
import { createMockScannedRepo } from "../../../test/factories/variant-analysis/shared/scanned-repositories";
import { createMockVariantAnalysis } from "../../../test/factories/variant-analysis/shared/variant-analysis";
import { createMockRepositoryWithMetadata } from "../../../test/factories/variant-analysis/shared/repository";
import type { RepositoriesFilterSortState } from "../../variant-analysis/shared/variant-analysis-filter-sort";
import { defaultFilterSortState } from "../../variant-analysis/shared/variant-analysis-filter-sort";

export default {
  title: "Variant Analysis/Variant Analysis Outcome Panels",
  component: VariantAnalysisOutcomePanels,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    ),
  ],
} as Meta<typeof VariantAnalysisOutcomePanels>;

const Template: StoryFn<typeof VariantAnalysisOutcomePanels> = (args) => {
  const [filterSortState, setFilterSortState] =
    useState<RepositoriesFilterSortState>(defaultFilterSortState);

  return (
    <VariantAnalysisOutcomePanels
      {...args}
      filterSortState={filterSortState}
      setFilterSortState={setFilterSortState}
    />
  );
};

export const WithoutSkippedRepos = Template.bind({});
WithoutSkippedRepos.args = {
  variantAnalysis: createMockVariantAnalysis({
    status: VariantAnalysisStatus.InProgress,
    scannedRepos: [
      {
        ...createMockScannedRepo("hello-world-1"),
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 99_999,
      },
      {
        ...createMockScannedRepo("hello-world-2"),
        analysisStatus: VariantAnalysisRepoStatus.Failed,
      },
      {
        ...createMockScannedRepo("hello-world-3"),
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 0,
      },
      {
        ...createMockScannedRepo("hello-world-4"),
        resultCount: undefined,
      },
      {
        ...createMockScannedRepo("hello-world-5"),
        resultCount: undefined,
      },
      {
        ...createMockScannedRepo("hello-world-6"),
        resultCount: undefined,
      },
      {
        ...createMockScannedRepo("hello-world-7"),
        resultCount: undefined,
      },
      {
        ...createMockScannedRepo("hello-world-8"),
        resultCount: undefined,
      },
      {
        ...createMockScannedRepo("hello-world-9"),
        resultCount: undefined,
      },
      {
        ...createMockScannedRepo("hello-world-10"),
        resultCount: undefined,
      },
    ],
  }),
};

export const WithSkippedRepos = Template.bind({});
WithSkippedRepos.args = {
  ...WithoutSkippedRepos.args,
  variantAnalysis: createMockVariantAnalysis({
    status: VariantAnalysisStatus.InProgress,
    scannedRepos: WithoutSkippedRepos.args.variantAnalysis?.scannedRepos,
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
  }),
};

export const WithOnlyWarningsSkippedRepos = Template.bind({});
WithOnlyWarningsSkippedRepos.args = {
  ...WithoutSkippedRepos.args,
  variantAnalysis: createMockVariantAnalysis({
    status: VariantAnalysisStatus.InProgress,
    scannedRepos: WithoutSkippedRepos.args.variantAnalysis?.scannedRepos,
    skippedRepos: {
      ...WithSkippedRepos.args.variantAnalysis?.skippedRepos,
      notFoundRepos: undefined,
      noCodeqlDbRepos: undefined,
    },
  }),
};
