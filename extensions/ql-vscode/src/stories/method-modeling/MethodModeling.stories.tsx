import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { MethodModeling as MethodModelingComponent } from "../../view/method-modeling/MethodModeling";
import { createMethod } from "../../../test/factories/model-editor/method-factories";
export default {
  title: "Method Modeling/Method Modeling",
  component: MethodModelingComponent,
} as Meta<typeof MethodModelingComponent>;

const Template: StoryFn<typeof MethodModelingComponent> = (args) => (
  <MethodModelingComponent {...args} />
);

const method = createMethod();

export const MethodUnmodeled = Template.bind({});
MethodUnmodeled.args = {
  method,
  modelingStatus: "unmodeled",
};

export const MethodModeled = Template.bind({});
MethodModeled.args = {
  method,

  modelingStatus: "unsaved",
};

export const MethodSaved = Template.bind({});
MethodSaved.args = {
  method,
  modelingStatus: "saved",
};
