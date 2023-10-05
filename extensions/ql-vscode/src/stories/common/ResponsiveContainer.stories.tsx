import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { ResponsiveContainer as ResponsiveContainerComponent } from "../../view/common/ResponsiveContainer";

export default {
  title: "Responsive Container",
  component: ResponsiveContainerComponent,
} as Meta<typeof ResponsiveContainerComponent>;

const Template: StoryFn<typeof ResponsiveContainerComponent> = (args) => (
  <ResponsiveContainerComponent>
    <span>Hello</span>
  </ResponsiveContainerComponent>
);

export const ResponsiveContainer = Template.bind({});
