import type { Meta, StoryFn } from "@storybook/react";

import { SuggestBox as SuggestBoxComponent } from "../../view/common/SuggestBox";

export default {
  title: "Suggest Box",
  component: SuggestBoxComponent,
} as Meta<typeof SuggestBoxComponent>;

const Template: StoryFn<typeof SuggestBoxComponent> = () => (
  <SuggestBoxComponent />
);

export const SuggestBox = Template.bind({});
