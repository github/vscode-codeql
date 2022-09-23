import React from 'react';

import { ComponentStory, ComponentMeta } from '@storybook/react';

import { VariantAnalysis as VariantAnalysisComponent } from '../../view/variant-analysis/VariantAnalysis';

export default {
  title: 'Variant Analysis/Variant Analysis',
  component: VariantAnalysisComponent,
} as ComponentMeta<typeof VariantAnalysisComponent>;

const Template: ComponentStory<typeof VariantAnalysisComponent> = () => (
  <VariantAnalysisComponent />
);

export const VariantAnalysis = Template.bind({});
