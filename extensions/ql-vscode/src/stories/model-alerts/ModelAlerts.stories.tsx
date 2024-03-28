import type { Meta, StoryFn } from "@storybook/react";

import { ModelAlerts as ModelAlertsComponent } from "../../view/model-alerts/ModelAlerts";
import { createMockVariantAnalysis } from "../../../test/factories/variant-analysis/shared/variant-analysis";
import { VariantAnalysisRepoStatus } from "../../variant-analysis/shared/variant-analysis";
import type { VariantAnalysisScannedRepositoryResult } from "../../variant-analysis/shared/variant-analysis";
import { createMockAnalysisAlert } from "../../../test/factories/variant-analysis/shared/analysis-alert";

export default {
  title: "Model Alerts/Model Alerts",
  component: ModelAlertsComponent,
} as Meta<typeof ModelAlertsComponent>;

const Template: StoryFn<typeof ModelAlertsComponent> = (args) => (
  <ModelAlertsComponent {...args} />
);

const variantAnalysis = createMockVariantAnalysis({
  modelPacks: [
    {
      name: "Model pack 1",
      path: "/path/to/model-pack-1",
    },
    {
      name: "Model pack 2",
      path: "/path/to/model-pack-2",
    },
  ],
  scannedRepos: [
    {
      repository: {
        id: 1,
        fullName: "org/repo1",
        private: false,
        stargazersCount: 100,
        updatedAt: new Date().toISOString(),
      },
      analysisStatus: VariantAnalysisRepoStatus.InProgress,
      resultCount: 0,
      artifactSizeInBytes: 0,
    },
    {
      repository: {
        id: 2,
        fullName: "org/repo2",
        private: false,
        stargazersCount: 100,
        updatedAt: new Date().toISOString(),
      },
      analysisStatus: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 0,
      artifactSizeInBytes: 0,
    },
    {
      repository: {
        id: 3,
        fullName: "org/repo3",
        private: false,
        stargazersCount: 100,
        updatedAt: new Date().toISOString(),
      },
      analysisStatus: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 1,
      artifactSizeInBytes: 0,
    },
    {
      repository: {
        id: 4,
        fullName: "org/repo4",
        private: false,
        stargazersCount: 100,
        updatedAt: new Date().toISOString(),
      },
      analysisStatus: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 3,
      artifactSizeInBytes: 0,
    },
  ],
});

const repoResults: VariantAnalysisScannedRepositoryResult[] = [
  {
    variantAnalysisId: variantAnalysis.id,
    repositoryId: 2,
    interpretedResults: [createMockAnalysisAlert(), createMockAnalysisAlert()],
  },
  {
    variantAnalysisId: variantAnalysis.id,
    repositoryId: 3,
    interpretedResults: [
      createMockAnalysisAlert(),
      createMockAnalysisAlert(),
      createMockAnalysisAlert(),
    ],
  },
  {
    variantAnalysisId: variantAnalysis.id,
    repositoryId: 4,
    interpretedResults: [createMockAnalysisAlert()],
  },
];

export const ModelAlerts = Template.bind({});
ModelAlerts.args = {
  initialViewState: { title: "codeql/sql2o-models" },
  variantAnalysis,
  repoResults,
};
