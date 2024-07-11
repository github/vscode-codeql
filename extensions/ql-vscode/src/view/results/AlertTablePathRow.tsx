import type { ThreadFlow } from "sarif";
import type {
  PathNode,
  Result as ResultKeysResult,
  ResultKey,
} from "./result-keys";
import { equalsNotUndefined } from "./result-keys";
import { selectableZebraStripe } from "./result-table-utils";
import { AlertTablePathNodeRow } from "./AlertTablePathNodeRow";
import { AlertTableDropdownIndicatorCell } from "./AlertTableDropdownIndicatorCell";
import { useCallback, useMemo } from "react";
import { VerticalRule } from "../common/VerticalRule";

interface Props {
  path: ThreadFlow;
  pathIndex: number;
  resultIndex: number;
  currentPathExpanded: boolean;
  selectedItem: undefined | ResultKey;
  selectedItemRef: React.RefObject<HTMLTableRowElement>;
  databaseUri: string;
  sourceLocationPrefix: string;
  updateSelectionCallback: (
    resultKey: PathNode | ResultKeysResult | undefined,
  ) => void;
  toggleExpanded: (e: React.MouseEvent, keys: ResultKey[]) => void;
}

export function AlertTablePathRow(props: Props) {
  const {
    path,
    pathIndex,
    resultIndex,
    currentPathExpanded,
    selectedItem,
    selectedItemRef,
    toggleExpanded,
  } = props;

  const pathKey = useMemo(
    () => ({ resultIndex, pathIndex }),
    [pathIndex, resultIndex],
  );
  const handleDropdownClick = useCallback(
    (e: React.MouseEvent) => toggleExpanded(e, [pathKey]),
    [pathKey, toggleExpanded],
  );

  const isPathSpecificallySelected = equalsNotUndefined(pathKey, selectedItem);

  return (
    <>
      <tr
        ref={isPathSpecificallySelected ? selectedItemRef : undefined}
        {...selectableZebraStripe(isPathSpecificallySelected, resultIndex)}
      >
        <td className="vscode-codeql__icon-cell">
          <VerticalRule />
        </td>
        <AlertTableDropdownIndicatorCell
          expanded={currentPathExpanded}
          onClick={handleDropdownClick}
        />
        <td className="vscode-codeql__text-center" colSpan={4}>
          Path
        </td>
      </tr>
      {currentPathExpanded &&
        path.locations.map((step, pathNodeIndex) => (
          <AlertTablePathNodeRow
            key={`${resultIndex}-${pathIndex}-${pathNodeIndex}`}
            {...props}
            step={step}
            pathNodeIndex={pathNodeIndex}
          />
        ))}
    </>
  );
}
