import { withTheme } from "./withTheme";
import { VSCodeTheme } from "./theme";

export const decorators = [withTheme];

export const globals = {
  vscodeTheme: VSCodeTheme.Dark,
};
