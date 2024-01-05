import type { Meta, StoryFn } from "@storybook/react";

import { VariantAnalysisContainer } from "../../view/variant-analysis/VariantAnalysisContainer";
import { QueryDetails as QueryDetailsComponent } from "../../view/variant-analysis/QueryDetails";

export default {
  title: "Variant Analysis/Query Details",
  component: QueryDetailsComponent,
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
  },
} as Meta<typeof QueryDetailsComponent>;

const Template: StoryFn<typeof QueryDetailsComponent> = (args) => (
  <QueryDetailsComponent {...args} />
);

export const QueryDetails = Template.bind({});
QueryDetails.args = {
  queryName: "Query name",
  queryFileName: "example.ql",
};
