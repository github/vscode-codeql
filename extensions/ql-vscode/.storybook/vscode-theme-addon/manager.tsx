import * as React from "react";
import { addons } from "@storybook/manager-api";
import { Addon_TypesEnum } from "storybook/internal/types";
import { ThemeSelector } from "./ThemeSelector";

const ADDON_ID = "vscode-theme-addon";

addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    title: "VSCode Themes",
    type: Addon_TypesEnum.TOOL,
    match: ({ viewMode }) => !!(viewMode && viewMode.match(/^(story|docs)$/)),
    render: () => <ThemeSelector />,
  });
});
