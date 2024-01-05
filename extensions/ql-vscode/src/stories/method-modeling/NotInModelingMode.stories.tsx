import type { Meta, StoryFn } from "@storybook/react";

import { NotInModelingMode as NotInModelingModeComponent } from "../../view/method-modeling/NotInModelingMode";

export default {
  title: "Method Modeling/Not In Modeling Mode",
  component: NotInModelingModeComponent,
} as Meta<typeof NotInModelingModeComponent>;

const Template: StoryFn<typeof NotInModelingModeComponent> = () => (
  <NotInModelingModeComponent />
);

export const NotInModelingMode = Template.bind({});
