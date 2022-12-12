import * as React from "react";

import { ComponentStory, ComponentMeta } from "@storybook/react";

import {
  CodePaths,
  SuccessIcon as SuccessIconComponent,
} from "../../../view/common";

export default {
  title: "Icon/Success Icon",
  component: SuccessIconComponent,
} as ComponentMeta<typeof CodePaths>;

const Template: ComponentStory<typeof SuccessIconComponent> = (args) => (
  <SuccessIconComponent {...args} />
);

export const SuccessIcon = Template.bind({});
