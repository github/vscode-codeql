import type { Result, Run } from "sarif";
import type {
  PathNode,
  Result as ResultKeysResult,
  ResultKey,
} from "./result-keys";
import { getAllPaths, keyToString } from "./result-keys";
import { info, listUnordered } from "./octicons";
import { selectableZebraStripe } from "./result-table-utils";
import { AlertTableDropdownIndicatorCell } from "./AlertTableDropdownIndicatorCell";
import { useCallback, useMemo } from "react";
import { SarifLocation } from "./locations/SarifLocation";
import { SarifMessageWithLocations } from "./locations/SarifMessageWithLocations";
import { AlertTablePathRow } from "./AlertTablePathRow";
import type { UserSettings } from "../../common/interface-types";
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react";

export interface Props {
  result: Result;
  resultIndex: number;
  expanded: Set<string>;
  selectedItem: undefined | ResultKey;
  selectedItemRef: React.RefObject<HTMLTableRowElement>;
  databaseUri: string;
  sourceLocationPrefix: string;
  run?: Run;
  userSettings: UserSettings;
  updateSelectionCallback: (
    resultKey: PathNode | ResultKeysResult | undefined,
  ) => void;
  toggleExpanded: (e: React.MouseEvent, keys: ResultKey[]) => void;
}

export function AlertTableResultRow(props: Props) {
  const {
    result,
    resultIndex,
    expanded,
    selectedItem,
    selectedItemRef,
    databaseUri,
    sourceLocationPrefix,
    updateSelectionCallback,
    toggleExpanded,
  } = props;

  const resultKey: ResultKeysResult = useMemo(
    () => ({ resultIndex }),
    [resultIndex],
  );

  const handleSarifLocationClicked = useCallback(
    () => updateSelectionCallback(resultKey),
    [resultKey, updateSelectionCallback],
  );
  const handleDropdownClick = useCallback(
    (e: React.MouseEvent) => {
      const indices =
        getAllPaths(result).length === 1
          ? [resultKey, { ...resultKey, pathIndex: 0 }]
          : /* if there's exactly one path, auto-expand
             * the path when expanding the result */
            [resultKey];
      toggleExpanded(e, indices);
    },
    [result, resultKey, toggleExpanded],
  );

  const resultRowIsSelected =
    selectedItem?.resultIndex === resultIndex &&
    selectedItem.pathIndex === undefined;

  const text = result.message.text || "[no text]";
  const msg =
    result.relatedLocations === undefined ? (
      <span key="0">{text}</span>
    ) : (
      <SarifMessageWithLocations
        msg={text}
        relatedLocations={result.relatedLocations}
        sourceLocationPrefix={sourceLocationPrefix}
        databaseUri={databaseUri}
        onClick={handleSarifLocationClicked}
      />
    );

  const allPaths = getAllPaths(result);
  const shortestPath = Math.min(
    ...allPaths.map((path) => path.locations.length),
  );

  const currentResultExpanded = expanded.has(keyToString(resultKey));
  return (
    <>
      <tr
        ref={resultRowIsSelected ? selectedItemRef : undefined}
        {...selectableZebraStripe(resultRowIsSelected, resultIndex)}
      >
        {result.codeFlows === undefined ? (
          <>
            <td className="vscode-codeql__icon-cell">{info}</td>
            <td colSpan={4}>{msg}</td>
          </>
        ) : (
          <>
            <AlertTableDropdownIndicatorCell
              expanded={currentResultExpanded}
              onClick={handleDropdownClick}
            />
            <td className="vscode-codeql__icon-cell">{listUnordered}</td>
            <td className="vscode-codeql__icon-cell">
              <VSCodeBadge title="Shortest path">{shortestPath}</VSCodeBadge>
            </td>
            <td colSpan={3}>{msg}</td>
          </>
        )}
        <td className="vscode-codeql__location-cell">
          {result.locations && result.locations.length > 0 && (
            <SarifLocation
              loc={result.locations[0]}
              sourceLocationPrefix={sourceLocationPrefix}
              databaseUri={databaseUri}
              onClick={handleSarifLocationClicked}
            />
          )}
        </td>
      </tr>
      {currentResultExpanded &&
        result.codeFlows &&
        allPaths.map((path, pathIndex) => (
          <AlertTablePathRow
            key={`${resultIndex}-${pathIndex}`}
            {...props}
            path={path}
            pathIndex={pathIndex}
            currentPathExpanded={expanded.has(
              keyToString({ resultIndex, pathIndex }),
            )}
          />
        ))}
    </>
  );
}
