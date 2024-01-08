import type { Meta, StoryFn } from "@storybook/react";

import { NoMethodSelected as NoMethodSelectedComponent } from "../../view/method-modeling/NoMethodSelected";

export default {
  title: "Method Modeling/No Method Selected",
  component: NoMethodSelectedComponent,
} as Meta<typeof NoMethodSelectedComponent>;

const Template: StoryFn<typeof NoMethodSelectedComponent> = () => (
  <NoMethodSelectedComponent />
);

export const NoMethodSelected = Template.bind({});
