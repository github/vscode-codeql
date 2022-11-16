import React from "react";

import { ComponentMeta } from "@storybook/react";

import DownloadSpinnerComponent from "../../view/remote-queries/DownloadSpinner";

export default {
  title: "Download Spinner",
  component: DownloadSpinnerComponent,
} as ComponentMeta<typeof DownloadSpinnerComponent>;

export const DownloadSpinner = <DownloadSpinnerComponent />;
