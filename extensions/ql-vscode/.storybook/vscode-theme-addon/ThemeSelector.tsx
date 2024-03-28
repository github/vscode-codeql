import * as React from "react";
import type { FunctionComponent } from "react";
import { useCallback } from "react";

import { useGlobals } from "@storybook/manager-api";
import {
  IconButton,
  TooltipLinkList,
  WithTooltip,
} from "@storybook/components";
import { DashboardIcon } from "@storybook/icons";

import { themeNames, VSCodeTheme } from "./theme";

export const ThemeSelector: FunctionComponent = () => {
  const [{ vscodeTheme }, updateGlobals] = useGlobals();

  const changeTheme = useCallback(
    (theme: VSCodeTheme) => {
      updateGlobals({
        vscodeTheme: theme,
      });
    },
    [updateGlobals],
  );

  const createLinks = useCallback(
    (onHide: () => void) =>
      Object.values(VSCodeTheme).map((theme) => ({
        id: theme,
        onClick() {
          changeTheme(theme);
          onHide();
        },
        title: themeNames[theme],
        value: theme,
        active: vscodeTheme === theme,
      })),
    [vscodeTheme, changeTheme],
  );

  return (
    <WithTooltip
      placement="top"
      trigger="click"
      closeOnOutsideClick
      tooltip={({ onHide }: { onHide: () => void }) => (
        <TooltipLinkList links={createLinks(onHide)} />
      )}
    >
      <IconButton
        key="theme"
        title="Change the theme of the preview"
        active={vscodeTheme !== VSCodeTheme.Dark}
      >
        <DashboardIcon />
      </IconButton>
    </WithTooltip>
  );
};
