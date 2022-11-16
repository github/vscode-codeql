import React from "react";

import { ComponentStory, ComponentMeta } from "@storybook/react";

import DownloadButtonComponent from "../../view/remote-queries/DownloadButton";

export default {
  title: "Download Button",
  component: DownloadButtonComponent,
  argTypes: {
    onClick: {
      action: "clicked",
      table: {
        disable: true,
      },
    },
  },
} as ComponentMeta<typeof DownloadButtonComponent>;

const Template: ComponentStory<typeof DownloadButtonComponent> = (args) => (
  <DownloadButtonComponent {...args} />
);

export const DownloadButton = Template.bind({});
DownloadButton.args = {
  text: "Download",
};
