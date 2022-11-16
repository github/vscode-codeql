export enum VSCodeTheme {
  Dark = "dark",
  Light = "light",
}

export const themeNames: { [key in VSCodeTheme]: string } = {
  [VSCodeTheme.Dark]: "Dark+",
  [VSCodeTheme.Light]: "Light+",
};
