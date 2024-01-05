import type { Meta, StoryFn } from "@storybook/react";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import { VariantAnalysisHeader } from "../../view/variant-analysis/VariantAnalysisHeader";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus,
} from "../../variant-analysis/shared/variant-analysis";
import { createMockVariantAnalysis } from "../../../test/factories/variant-analysis/shared/variant-analysis";
import { createMockScannedRepo } from "../../../test/factories/variant-analysis/shared/scanned-repositories";

export default {
  title: "Variant Analysis/Variant Analysis Header",
  component: VariantAnalysisHeader,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    ),
  ],
  argTypes: {
    onOpenQueryFileClick: {
      action: "open-query-file-clicked",
      table: {
        disable: true,
      },
    },
    onViewQueryTextClick: {
      action: "view-query-text-clicked",
      table: {
        disable: true,
      },
    },
    onStopQueryClick: {
      action: "stop-query-clicked",
      table: {
        disable: true,
      },
    },
    onCopyRepositoryListClick: {
      action: "copy-repository-list-clicked",
      table: {
        disable: true,
      },
    },
    onExportResultsClick: {
      action: "export-results-clicked",
      table: {
        disable: true,
      },
    },
    onViewLogsClick: {
      action: "view-logs-clicked",
      table: {
        disable: true,
      },
    },
  },
} as Meta<typeof VariantAnalysisHeader>;

const Template: StoryFn<typeof VariantAnalysisHeader> = (args) => (
  <VariantAnalysisHeader {...args} />
);

export const InProgress = Template.bind({});
InProgress.args = {
  variantAnalysis: createMockVariantAnalysis({
    status: VariantAnalysisStatus.InProgress,
    scannedRepos: [
      {
        ...createMockScannedRepo(),
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 99_999,
      },
      {
        ...createMockScannedRepo(),
        analysisStatus: VariantAnalysisRepoStatus.Failed,
      },
      {
        ...createMockScannedRepo(),
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 0,
      },
      createMockScannedRepo(),
      createMockScannedRepo(),
      createMockScannedRepo(),
      createMockScannedRepo(),
      createMockScannedRepo(),
      createMockScannedRepo(),
      createMockScannedRepo(),
    ],
  }),
};

export const Succeeded = Template.bind({});
Succeeded.args = {
  ...InProgress.args,
  variantAnalysis: {
    ...createMockVariantAnalysis({
      status: VariantAnalysisStatus.Succeeded,
      scannedRepos: Array.from({ length: 1000 }, (_) => ({
        ...createMockScannedRepo(),
        analysisStatus: VariantAnalysisRepoStatus.Succeeded,
        resultCount: 100,
      })),
    }),
    createdAt: new Date(1661262726000).toISOString(),
    completedAt: new Date(1661263446000).toISOString(),
  },
};

export const Failed = Template.bind({});
Failed.args = {
  ...InProgress.args,
  variantAnalysis: {
    ...createMockVariantAnalysis({
      status: VariantAnalysisStatus.Failed,
      scannedRepos: [],
      skippedRepos: {},
    }),
    createdAt: new Date(1661263436000).toISOString(),
    completedAt: new Date(1661263446000).toISOString(),
  },
};
