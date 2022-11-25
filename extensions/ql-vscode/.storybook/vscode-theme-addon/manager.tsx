import * as React from "react";
import { addons, types } from "@storybook/addons";
import { ThemeSelector } from "./ThemeSelector";

const ADDON_ID = "vscode-theme-addon";

addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    title: "VSCode Themes",
    type: types.TOOL,
    match: ({ viewMode }) => !!(viewMode && viewMode.match(/^(story|docs)$/)),
    render: () => <ThemeSelector />,
  });
});
