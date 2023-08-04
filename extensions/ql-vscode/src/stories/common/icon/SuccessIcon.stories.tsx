import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import {
  CodePaths,
  SuccessIcon as SuccessIconComponent,
} from "../../../view/common";

export default {
  title: "Icon/Success Icon",
  component: SuccessIconComponent,
} as Meta<typeof CodePaths>;

const Template: StoryFn<typeof SuccessIconComponent> = (args) => (
  <SuccessIconComponent {...args} />
);

export const SuccessIcon = Template.bind({});
