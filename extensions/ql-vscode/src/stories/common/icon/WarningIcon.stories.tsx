import React from "react";

import { ComponentStory, ComponentMeta } from "@storybook/react";

import {
  CodePaths,
  WarningIcon as WarningIconComponent,
} from "../../../view/common";

export default {
  title: "Icon/Warning Icon",
  component: WarningIconComponent,
} as ComponentMeta<typeof CodePaths>;

const Template: ComponentStory<typeof WarningIconComponent> = (args) => (
  <WarningIconComponent {...args} />
);

export const WarningIcon = Template.bind({});
