import * as React from "react";

import { ComponentStory, ComponentMeta } from "@storybook/react";

import {
  CodePaths,
  ErrorIcon as ErrorIconComponent,
} from "../../../view/common";

export default {
  title: "Icon/Error Icon",
  component: ErrorIconComponent,
} as ComponentMeta<typeof CodePaths>;

const Template: ComponentStory<typeof ErrorIconComponent> = (args) => (
  <ErrorIconComponent {...args} />
);

export const ErrorIcon = Template.bind({});
