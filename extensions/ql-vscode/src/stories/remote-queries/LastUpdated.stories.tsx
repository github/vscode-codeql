import * as React from "react";

import { ComponentStory, ComponentMeta } from "@storybook/react";

import LastUpdatedComponent from "../../view/remote-queries/LastUpdated";

export default {
  title: "MRVA/Last Updated",
  component: LastUpdatedComponent,
} as ComponentMeta<typeof LastUpdatedComponent>;

const Template: ComponentStory<typeof LastUpdatedComponent> = (args) => (
  <LastUpdatedComponent {...args} />
);

export const LastUpdated = Template.bind({});

LastUpdated.args = {
  lastUpdated: -3_600_000, // 1 hour ago
};
