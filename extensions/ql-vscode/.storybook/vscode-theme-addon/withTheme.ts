/// <reference types="vite/client" />

import { useEffect } from "react";
import type {
  PartialStoryFn as StoryFunction,
  StoryContext,
} from "@storybook/csf";

import { VSCodeTheme } from "./theme";

import darkThemeStyle from "../../src/stories/vscode-theme-dark.css?url";
import lightThemeStyle from "../../src/stories/vscode-theme-light.css?url";
import lightHighContrastThemeStyle from "../../src/stories/vscode-theme-light-high-contrast.css?url";
import darkHighContrastThemeStyle from "../../src/stories/vscode-theme-dark-high-contrast.css?url";
import githubLightDefaultThemeStyle from "../../src/stories/vscode-theme-github-light-default.css?url";
import githubDarkDefaultThemeStyle from "../../src/stories/vscode-theme-github-dark-default.css?url";

const themeFiles: { [key in VSCodeTheme]: string } = {
  [VSCodeTheme.Dark]: darkThemeStyle,
  [VSCodeTheme.Light]: lightThemeStyle,
  [VSCodeTheme.LightHighContrast]: lightHighContrastThemeStyle,
  [VSCodeTheme.DarkHighContrast]: darkHighContrastThemeStyle,
  [VSCodeTheme.GitHubLightDefault]: githubLightDefaultThemeStyle,
  [VSCodeTheme.GitHubDarkDefault]: githubDarkDefaultThemeStyle,
};

export const withTheme = (StoryFn: StoryFunction, context: StoryContext) => {
  const { vscodeTheme } = context.globals;

  useEffect(() => {
    const styleSelectorId =
      context.viewMode === "docs"
        ? `addon-vscode-theme-docs-${context.id}`
        : "addon-vscode-theme-theme";

    const theme = Object.values(VSCodeTheme).includes(vscodeTheme)
      ? (vscodeTheme as VSCodeTheme)
      : VSCodeTheme.Dark;

    document.getElementById(styleSelectorId)?.remove();

    const link = document.createElement("link");
    link.id = styleSelectorId;
    link.href = themeFiles[theme];
    link.rel = "stylesheet";

    document.head.appendChild(link);
  }, [vscodeTheme]);

  return StoryFn();
};
