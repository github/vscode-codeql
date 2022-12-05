import React from "react";

import { ComponentMeta, ComponentStory } from "@storybook/react";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import { AnalysisAlert } from "../../remote-queries/shared/analysis-result";

import analysesResults from "../remote-queries/data/analysesResultsMessage.json";
import { InterpretedResults } from "../../view/variant-analysis/InterpretedResults";

export default {
  title: "Variant Analysis/Interpreted Results",
  component: InterpretedResults,
  decorators: [
    (Story) => (
      <VariantAnalysisContainer>
        <Story />
      </VariantAnalysisContainer>
    ),
  ],
} as ComponentMeta<typeof InterpretedResults>;

const Template: ComponentStory<typeof InterpretedResults> = (args) => (
  <InterpretedResults {...args} />
);

const interpretedResultsForRepo = (
  nwo: string,
): AnalysisAlert[] | undefined => {
  return analysesResults.analysesResults.find((v) => v.nwo === nwo)
    ?.interpretedResults as unknown as AnalysisAlert[];
};

export const Example = Template.bind({});
Example.args = {
  interpretedResults: interpretedResultsForRepo("facebook/create-react-app"),
};
