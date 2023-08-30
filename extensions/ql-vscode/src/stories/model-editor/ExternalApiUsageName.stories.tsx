import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { ExternalApiUsageName as ExternalApiUsageNameComponent } from "../../view/model-editor/ExternalApiUsageName";
import { createExternalApiUsage } from "../../../test/factories/data-extension/external-api-factories";

export default {
  title: "CodeQL Model Editor/External API Usage Name",
  component: ExternalApiUsageNameComponent,
} as Meta<typeof ExternalApiUsageNameComponent>;

const Template: StoryFn<typeof ExternalApiUsageNameComponent> = (args) => (
  <ExternalApiUsageNameComponent {...args} />
);

export const ExternalApiUsageName = Template.bind({});
ExternalApiUsageName.args = createExternalApiUsage();
