import type { Meta, StoryFn } from "@storybook/react";

import { MethodAlreadyModeled as MethodAlreadyModeledComponent } from "../../view/method-modeling/MethodAlreadyModeled";

export default {
  title: "Method Modeling/Method Already Modeled",
  component: MethodAlreadyModeledComponent,
} as Meta<typeof MethodAlreadyModeledComponent>;

const Template: StoryFn<typeof MethodAlreadyModeledComponent> = () => (
  <MethodAlreadyModeledComponent />
);

export const MethodAlreadyModeled = Template.bind({});
