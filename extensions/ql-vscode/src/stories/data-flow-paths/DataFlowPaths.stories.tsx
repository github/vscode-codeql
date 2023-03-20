import * as React from "react";

import { ComponentMeta, ComponentStory } from "@storybook/react";

import { DataFlowPaths as DataFlowPathsComponent } from "../../view/data-flow-paths/DataFlowPaths";
import { createMockDataFlowPaths } from "../../../test/factories/variant-analysis/shared/data-flow-paths";
export default {
  title: "Data Flow Paths/Data Flow Paths",
  component: DataFlowPathsComponent,
} as ComponentMeta<typeof DataFlowPathsComponent>;

const Template: ComponentStory<typeof DataFlowPathsComponent> = (args) => (
  <DataFlowPathsComponent {...args} />
);

export const PowerShell = Template.bind({});
PowerShell.args = {
  dataFlowPaths: createMockDataFlowPaths(),
};
