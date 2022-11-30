export enum VSCodeTheme {
  Dark = "dark",
  Light = "light",
  LightHighContrast = "light-high-contrast",
  DarkHighContrast = "dark-high-contrast",
  GitHubLightDefault = "github-light-default",
  GitHubDarkDefault = "github-dark-default",
}

export const themeNames: { [key in VSCodeTheme]: string } = {
  [VSCodeTheme.Dark]: "Dark+",
  [VSCodeTheme.Light]: "Light+",
  [VSCodeTheme.LightHighContrast]: "Light High Contrast",
  [VSCodeTheme.DarkHighContrast]: "Dark High Contrast",
  [VSCodeTheme.GitHubLightDefault]: "GitHub Light Default",
  [VSCodeTheme.GitHubDarkDefault]: "GitHub Dark Default",
};
