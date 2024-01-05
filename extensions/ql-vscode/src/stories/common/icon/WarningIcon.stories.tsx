import type { Meta, StoryFn } from "@storybook/react";

import type { CodePaths } from "../../../view/common";
import { WarningIcon as WarningIconComponent } from "../../../view/common";

export default {
  title: "Icon/Warning Icon",
  component: WarningIconComponent,
} as Meta<typeof CodePaths>;

const Template: StoryFn<typeof WarningIconComponent> = (args) => (
  <WarningIconComponent {...args} />
);

export const WarningIcon = Template.bind({});
