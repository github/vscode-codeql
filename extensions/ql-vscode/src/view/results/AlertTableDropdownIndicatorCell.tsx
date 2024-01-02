import TextButton from "../common/TextButton";
import { chevronDown, chevronRight } from "./octicons";

type Props = {
  expanded: boolean;
  onClick: (e: React.MouseEvent) => void;
};

export function AlertTableDropdownIndicatorCell({ expanded, onClick }: Props) {
  const indicator = expanded ? chevronDown : chevronRight;

  return (
    <td className="vscode-codeql__icon-cell">
      <TextButton onClick={onClick}>{indicator}</TextButton>
    </td>
  );
}
