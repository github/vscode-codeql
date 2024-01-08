import type { Meta, StoryFn } from "@storybook/react";

import { DataFlowPaths as DataFlowPathsComponent } from "../../view/data-flow-paths/DataFlowPaths";
import { createMockDataFlowPaths } from "../../../test/factories/variant-analysis/shared/data-flow-paths";
export default {
  title: "Data Flow Paths/Data Flow Paths",
  component: DataFlowPathsComponent,
} as Meta<typeof DataFlowPathsComponent>;

const Template: StoryFn<typeof DataFlowPathsComponent> = (args) => (
  <DataFlowPathsComponent {...args} />
);

export const PowerShell = Template.bind({});
PowerShell.args = {
  dataFlowPaths: createMockDataFlowPaths(),
};
