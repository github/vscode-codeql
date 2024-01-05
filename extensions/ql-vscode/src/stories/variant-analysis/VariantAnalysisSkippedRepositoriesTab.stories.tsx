import type { Meta, StoryFn } from "@storybook/react";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import { VariantAnalysisSkippedRepositoriesTab } from "../../view/variant-analysis/VariantAnalysisSkippedRepositoriesTab";
import { createMockRepositoryWithMetadata } from "../../../test/factories/variant-analysis/shared/repository";

export default {
  title: "Variant Analysis/Variant Analysis Skipped Repositories Tab",
  component: VariantAnalysisSkippedRepositoriesTab,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    ),
  ],
} as Meta<typeof VariantAnalysisSkippedRepositoriesTab>;

const Template: StoryFn<typeof VariantAnalysisSkippedRepositoriesTab> = (
  args,
) => <VariantAnalysisSkippedRepositoriesTab {...args} />;

export const NoAccessNoOmissions = Template.bind({});
NoAccessNoOmissions.args = {
  alertTitle: "No access",
  alertMessage:
    "The following repositories could not be scanned because you do not have read access.",
  skippedRepositoryGroup: {
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
};

export const NoAccessWithOmissions = Template.bind({});
NoAccessWithOmissions.args = {
  ...NoAccessNoOmissions.args,
  skippedRepositoryGroup: {
    repositoryCount: 12345,
    repositories: [
      {
        fullName: "octodemo/hello-globe",
      },
      {
        fullName: "octodemo/hello-planet",
      },
      {
        fullName: "octodemo/hello-universe",
      },
    ],
  },
};

export const NoDatabaseNoOmissions = Template.bind({});
NoDatabaseNoOmissions.args = {
  alertTitle: "No database",
  alertMessage:
    "The following repositories could not be scanned because they do not have an available CodeQL database.",
  skippedRepositoryGroup: {
    repositoryCount: 2,
    repositories: [
      {
        ...createMockRepositoryWithMetadata(),
        id: 1,
        fullName: "octodemo/hello-globe",
        private: false,
      },
      {
        ...createMockRepositoryWithMetadata(),
        id: 2,
        fullName: "octodemo/hello-planet",
        private: true,
      },
    ],
  },
};

export const NoDatabaseWithOmissions = Template.bind({});
NoDatabaseWithOmissions.args = {
  ...NoDatabaseNoOmissions.args,
  skippedRepositoryGroup: {
    repositoryCount: 12345,
    repositories: [
      {
        ...createMockRepositoryWithMetadata(),
        id: 1,
        fullName: "octodemo/hello-globe",
        private: false,
      },
      {
        ...createMockRepositoryWithMetadata(),
        id: 2,
        fullName: "octodemo/hello-planet",
        private: true,
      },
      {
        ...createMockRepositoryWithMetadata(),
        id: 3,
        fullName: "octodemo/hello-universe",
        private: false,
      },
    ],
  },
};
