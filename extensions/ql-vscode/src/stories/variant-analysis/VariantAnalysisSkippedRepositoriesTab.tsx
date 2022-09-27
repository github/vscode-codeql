import React from 'react';

import { ComponentMeta, ComponentStory } from '@storybook/react';

import { VariantAnalysisContainer } from '../../view/variant-analysis/VariantAnalysisContainer';
import { VariantAnalysisSkippedRepositoriesTab } from '../../view/variant-analysis/VariantAnalysisSkippedRepositoriesTab';

export default {
  title: 'Variant Analysis/Variant Analysis Skipped Repositories Tab',
  component: VariantAnalysisSkippedRepositoriesTab,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    )
  ],
} as ComponentMeta<typeof VariantAnalysisSkippedRepositoriesTab>;

const Template: ComponentStory<typeof VariantAnalysisSkippedRepositoriesTab> = (args) => (
  <VariantAnalysisSkippedRepositoriesTab {...args} />
);

export const NoAccessNoOmissions = Template.bind({});
NoAccessNoOmissions.args = {
  reason: 'no_access',
  skippedRepositoryGroup: {
    repositoryCount: 2,
    repositories: [
      {
        fullName: 'octodemo/hello-globe',
      },
      {
        fullName: 'octodemo/hello-planet',
      },
    ],
  },
};

export const NoAccessWithOmissions = Template.bind({});
NoAccessWithOmissions.args = {
  reason: 'no_access',
  skippedRepositoryGroup: {
    repositoryCount: 12345,
    repositories: [
      {
        fullName: 'octodemo/hello-globe',
      },
      {
        fullName: 'octodemo/hello-planet',
      },
      {
        fullName: 'octodemo/hello-universe',
      },
    ],
  },
};

export const NoDatabaseNoOmissions = Template.bind({});
NoDatabaseNoOmissions.args = {
  reason: 'no_database',
  skippedRepositoryGroup: {
    repositoryCount: 2,
    repositories: [
      {
        id: 1,
        fullName: 'octodemo/hello-globe',
        private: false,
      },
      {
        id: 2,
        fullName: 'octodemo/hello-planet',
        private: true,
      },
    ],
  },
};

export const NoDatabaseWithOmissions = Template.bind({});
NoDatabaseWithOmissions.args = {
  reason: 'no_database',
  skippedRepositoryGroup: {
    repositoryCount: 12345,
    repositories: [
      {
        id: 1,
        fullName: 'octodemo/hello-globe',
        private: false,
      },
      {
        id: 2,
        fullName: 'octodemo/hello-planet',
        private: true,
      },
      {
        id: 3,
        fullName: 'octodemo/hello-universe',
        private: false,
      },
    ],
  },
};
