import type { Meta, StoryFn } from "@storybook/react";

import { Codicon as CodiconComponent } from "../../../view/common";

// To regenerate the icons, use the following command from the `extensions/ql-vscode` directory:
// jq -R '[inputs | [splits(", *")] as $row | $row[0]]' < node_modules/@vscode/codicons/dist/codicon.csv > src/stories/common/icon/vscode-icons.json
// eslint-disable-next-line import/no-namespace -- This is an array in a JSON file, so we can't use named imports
import * as icons from "./vscode-icons.json";

export default {
  title: "Icon/Codicon",
  component: CodiconComponent,
  argTypes: {
    name: {
      control: "select",
      options: icons,
    },
  },
} as Meta<typeof CodiconComponent>;

const Template: StoryFn<typeof CodiconComponent> = (args) => (
  <CodiconComponent {...args} />
);

export const Codicon = Template.bind({});
Codicon.args = {
  name: "account",
  label: "Account",
};
