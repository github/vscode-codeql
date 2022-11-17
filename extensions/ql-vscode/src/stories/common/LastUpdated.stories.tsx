import React from "react";

import { ComponentStory, ComponentMeta } from "@storybook/react";

import { LastUpdated as LastUpdatedComponent } from "../../view/common/LastUpdated";

export default {
  title: "Last Updated",
  component: LastUpdatedComponent,
} as ComponentMeta<typeof LastUpdatedComponent>;

const Template: ComponentStory<typeof LastUpdatedComponent> = (args) => (
  <LastUpdatedComponent {...args} />
);

export const LastUpdated = Template.bind({});

LastUpdated.args = {
  lastUpdated: new Date(Date.now() - 3_600_000).toISOString(), // 1 hour ago
};
