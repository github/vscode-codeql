import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import {
  CodePaths,
  ErrorIcon as ErrorIconComponent,
} from "../../../view/common";

export default {
  title: "Icon/Error Icon",
  component: ErrorIconComponent,
} as Meta<typeof CodePaths>;

const Template: StoryFn<typeof ErrorIconComponent> = (args) => (
  <ErrorIconComponent {...args} />
);

export const ErrorIcon = Template.bind({});
