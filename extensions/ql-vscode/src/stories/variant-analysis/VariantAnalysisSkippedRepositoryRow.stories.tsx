import React from 'react';

import { ComponentMeta, ComponentStory } from '@storybook/react';

import { VariantAnalysisContainer } from '../../view/variant-analysis/VariantAnalysisContainer';
import { VariantAnalysisSkippedRepositoryRow } from '../../view/variant-analysis/VariantAnalysisSkippedRepositoryRow';

export default {
  title: 'Variant Analysis/Variant Analysis Skipped Repository',
  component: VariantAnalysisSkippedRepositoryRow,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    )
  ],
} as ComponentMeta<typeof VariantAnalysisSkippedRepositoryRow>;

const Template: ComponentStory<typeof VariantAnalysisSkippedRepositoryRow> = (args) => (
  <VariantAnalysisSkippedRepositoryRow {...args} />
);

export const OnlyFullName = Template.bind({});
OnlyFullName.args = {
  repository: {
    fullName: 'octodemo/hello-globe',
  }
};

export const Public = Template.bind({});
Public.args = {
  repository: {
    fullName: 'octodemo/hello-globe',
    private: false,
  }
};

export const Private = Template.bind({});
Private.args = {
  repository: {
    fullName: 'octodemo/hello-globe',
    private: true,
  }
};
