import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { MethodModeling as MethodModelingComponent } from "../../view/method-modeling/MethodModeling";
export default {
  title: "Method Modeling / Method Modelin",
  component: MethodModelingComponent,
} as Meta<typeof MethodModelingComponent>;

const Template: StoryFn<typeof MethodModelingComponent> = () => (
  <MethodModelingComponent />
);

export const MethodUnmodeled = Template.bind({});
MethodUnmodeled.args = {};

export const MethodModeled = Template.bind({});
MethodModeled.args = {};

export const MethodSaved = Template.bind({});
MethodSaved.args = {};
