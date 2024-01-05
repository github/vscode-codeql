import type { Meta, StoryFn } from "@storybook/react";

import { ClickableLocation as ClickableLocationComponent } from "../../../view/results/locations/ClickableLocation";

import "../../../view/results/resultsView.css";

export default {
  title: "Results/Clickable Location",
  component: ClickableLocationComponent,
} as Meta<typeof ClickableLocationComponent>;

const Template: StoryFn<typeof ClickableLocationComponent> = (args) => (
  <ClickableLocationComponent {...args} />
);

export const ClickableLocation = Template.bind({});
ClickableLocation.args = {
  loc: {
    type: "lineColumnLocation",
    uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
    startLine: 22,
    startColumn: 27,
    endLine: 22,
    endColumn: 57,
  },
  label: "url : String",
};
