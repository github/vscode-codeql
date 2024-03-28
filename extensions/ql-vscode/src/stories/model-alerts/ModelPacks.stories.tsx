import type { Meta, StoryFn } from "@storybook/react";

import { ModelPacks as ModelPacksComponent } from "../../view/model-alerts/ModelPacks";

export default {
  title: "Model Alerts/Model Packs",
  component: ModelPacksComponent,
  argTypes: {
    openModelPackClick: {
      action: "open-model-pack-clicked",
      table: {
        disable: true,
      },
    },
  },
} as Meta<typeof ModelPacksComponent>;

const Template: StoryFn<typeof ModelPacksComponent> = (args) => (
  <ModelPacksComponent {...args} />
);

export const ModelPacks = Template.bind({});
ModelPacks.args = {
  modelPacks: [
    {
      name: "Model pack 1",
      path: "/path/to/model-pack-1",
    },
    {
      name: "Model pack 2",
      path: "/path/to/model-pack-2",
    },
  ],
};
