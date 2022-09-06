import React from 'react';

import { ComponentStory, ComponentMeta } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';

export default {
  title: 'WebView UI Toolkit/Button',
  component: VSCodeButton,
  argTypes: {
    children: { control: 'text' },
    appearance: {
      control: {
        type: 'select',
        options: ['primary', 'secondary', 'icon'],
      },
    },
    onClick: {
      action: 'clicked',
      table: {
        disable: true,
      },
    },
  },
} as ComponentMeta<typeof VSCodeButton>;

const Template: ComponentStory<typeof VSCodeButton> = (args) => (
  <VSCodeButton {...args} />
);

export const Default: any = Template.bind({});
Default.args = {
  children: 'Button',
  onClick: action('button-clicked'),
};

export const Secondary = Template.bind({});
Secondary.args = {
  ...Default.args,
  appearance: 'secondary',
};
