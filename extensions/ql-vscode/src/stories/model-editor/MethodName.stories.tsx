import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { MethodName as MethodNameComponent } from "../../view/model-editor/MethodName";
import { createMethod } from "../../../test/factories/data-extension/method-factories";

export default {
  title: "CodeQL Model Editor/Method Name",
  component: MethodNameComponent,
} as Meta<typeof MethodNameComponent>;

const Template: StoryFn<typeof MethodNameComponent> = (args) => (
  <MethodNameComponent {...args} />
);

export const MethodName = Template.bind({});
MethodName.args = createMethod();
