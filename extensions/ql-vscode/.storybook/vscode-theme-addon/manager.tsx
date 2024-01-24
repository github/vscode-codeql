import * as React from "react";
import { addons, types } from "@storybook/manager-api";
import { ThemeSelector } from "./ThemeSelector";

const ADDON_ID = "vscode-theme-addon";

addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    title: "VSCode Themes",
    // eslint-disable-next-line deprecation/deprecation
    type: types.TOOL,
    match: ({ viewMode }) => !!(viewMode && viewMode.match(/^(story|docs)$/)),
    render: () => <ThemeSelector />,
  });
});
