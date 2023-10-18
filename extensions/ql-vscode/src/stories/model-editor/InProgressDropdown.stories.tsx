import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { InProgressDropdown as InProgressDropdownComponent } from "../../view/model-editor/InProgressDropdown";

export default {
  title: "CodeQL Model Editor/In Progress Dropdown",
  component: InProgressDropdownComponent,
} as Meta<typeof InProgressDropdownComponent>;

const Template: StoryFn<typeof InProgressDropdownComponent> = (args) => (
  <InProgressDropdownComponent />
);

export const InProgressDropdown = Template.bind({});
