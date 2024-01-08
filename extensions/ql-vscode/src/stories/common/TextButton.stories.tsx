import type { Meta, StoryFn } from "@storybook/react";

import TextButtonComponent from "../../view/common/TextButton";

export default {
  title: "Text Button",
  component: TextButtonComponent,
  argTypes: {
    onClick: {
      action: "clicked",
      table: {
        disable: true,
      },
    },
  },
} as Meta<typeof TextButtonComponent>;

const Template: StoryFn<typeof TextButtonComponent> = (args) => (
  <TextButtonComponent {...args} />
);

export const TextButton = Template.bind({});

TextButton.args = {
  children: "Show more",
  size: "x-small",
};
