import * as React from "react";
import { chevronDown, chevronRight } from "./octicons";

type Props = {
  expanded: boolean;
  onClick: (e: React.MouseEvent) => void;
};

export function AlertTableDropdownIndicatorCell({ expanded, onClick }: Props) {
  const indicator = expanded ? chevronDown : chevronRight;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <td
      className="vscode-codeql__icon-cell vscode-codeql__dropdown-cell"
      onMouseDown={onClick}
    >
      {indicator}
    </td>
  );
}
