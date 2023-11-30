import * as React from "react";
import * as Sarif from "sarif";
import * as Keys from "./result-keys";
import { selectableZebraStripe } from "./result-table-utils";
import { AlertTablePathNodeRow } from "./AlertTablePathNodeRow";
import { AlertTableDropdownIndicatorCell } from "./AlertTableDropdownIndicatorCell";
import { useCallback, useMemo } from "react";
import { MadFileLocation } from "../../common/interface-types";

interface Props {
  path: Sarif.ThreadFlow;
  pathIndex: number;
  resultIndex: number;
  currentPathExpanded: boolean;
  selectedItem: undefined | Keys.ResultKey;
  selectedItemRef: React.RefObject<any>;
  databaseUri: string;
  sourceLocationPrefix: string;
  updateSelectionCallback: (
    resultKey: Keys.PathNode | Keys.Result | undefined,
  ) => void;
  toggleExpanded: (e: React.MouseEvent, keys: Keys.ResultKey[]) => void;
  madData: Map<string, MadFileLocation[]>;
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

  const isPathSpecificallySelected = Keys.equalsNotUndefined(
    pathKey,
    selectedItem,
  );

  return (
    <>
      <tr
        ref={isPathSpecificallySelected ? selectedItemRef : undefined}
        {...selectableZebraStripe(isPathSpecificallySelected, resultIndex)}
      >
        <td className="vscode-codeql__icon-cell">
          <span className="vscode-codeql__vertical-rule"></span>
        </td>
        <AlertTableDropdownIndicatorCell
          expanded={currentPathExpanded}
          onClick={handleDropdownClick}
        />
        <td className="vscode-codeql__text-center" colSpan={3}>
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
