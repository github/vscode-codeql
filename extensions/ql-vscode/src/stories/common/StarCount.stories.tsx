import type { Meta, StoryFn } from "@storybook/react";

import StarCountComponent from "../../view/common/StarCount";

export default {
  title: "Star Count",
  component: StarCountComponent,
} as Meta<typeof StarCountComponent>;

const Template: StoryFn<typeof StarCountComponent> = (args) => (
  <StarCountComponent {...args} />
);

export const LessThan1000 = Template.bind({});
LessThan1000.args = {
  starCount: 100,
};

export const MoreThan1000 = Template.bind({});
MoreThan1000.args = {
  starCount: 7532,
};

export const MoreThan10000 = Template.bind({});
MoreThan10000.args = {
  starCount: 65287,
};

export const MoreThan100000 = Template.bind({});
MoreThan100000.args = {
  starCount: 1234234,
};
