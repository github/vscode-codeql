import type { Meta, StoryFn } from "@storybook/react";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import { VariantAnalysisLoading as VariantAnalysisLoadingComponent } from "../../view/variant-analysis/VariantAnalysisLoading";

export default {
  title: "Variant Analysis/Variant Analysis Loading",
  component: VariantAnalysisLoadingComponent,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    ),
  ],
  argTypes: {},
} as Meta<typeof VariantAnalysisLoadingComponent>;

const Template: StoryFn<typeof VariantAnalysisLoadingComponent> = () => (
  <VariantAnalysisLoadingComponent />
);

export const VariantAnalysisLoading = Template.bind({});
