import { useEffect } from "react";
import type {
  PartialStoryFn as StoryFunction,
  StoryContext,
} from "@storybook/csf";

import { VSCodeTheme } from "./theme";

const themeFiles: { [key in VSCodeTheme]: string } = {
  [VSCodeTheme.Dark]:
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("!file-loader?modules!../../src/stories/vscode-theme-dark.css")
      .default,
  [VSCodeTheme.Light]:
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("!file-loader?modules!../../src/stories/vscode-theme-light.css")
      .default,
  [VSCodeTheme.LightHighContrast]:
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("!file-loader?modules!../../src/stories/vscode-theme-light-high-contrast.css")
      .default,
  [VSCodeTheme.DarkHighContrast]:
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("!file-loader?modules!../../src/stories/vscode-theme-dark-high-contrast.css")
      .default,
  [VSCodeTheme.GitHubLightDefault]:
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("!file-loader?modules!../../src/stories/vscode-theme-github-light-default.css")
      .default,
  [VSCodeTheme.GitHubDarkDefault]:
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("!file-loader?modules!../../src/stories/vscode-theme-github-dark-default.css")
      .default,
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
