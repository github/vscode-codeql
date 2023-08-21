import * as React from "react";
import * as Sarif from "sarif";
import * as Keys from "./result-keys";
import { info, listUnordered } from "./octicons";
import { ScrollIntoViewHelper } from "./scroll-into-view-helper";
import { selectableZebraStripe } from "./result-table-utils";
import { AlertTableDropdownIndicatorCell } from "./AlertTableDropdownIndicatorCell";
import { useCallback, useMemo } from "react";
import { SarifLocation } from "./locations/SarifLocation";
import { SarifMessageWithLocations } from "./locations/SarifMessageWithLocations";
import { AlertTablePathRow } from "./AlertTablePathRow";

interface Props {
  result: Sarif.Result;
  resultIndex: number;
  expanded: Set<string>;
  selectedItem: undefined | Keys.ResultKey;
  databaseUri: string;
  sourceLocationPrefix: string;
  updateSelectionCallback: (
    resultKey: Keys.PathNode | Keys.Result | undefined,
  ) => () => void;
  toggleExpanded: (e: React.MouseEvent, keys: Keys.ResultKey[]) => void;
  scroller: ScrollIntoViewHelper;
}

export function AlertTableResultRow(props: Props) {
  const {
    result,
    resultIndex,
    expanded,
    selectedItem,
    databaseUri,
    sourceLocationPrefix,
    updateSelectionCallback,
    toggleExpanded,
    scroller,
  } = props;

  const resultKey: Keys.Result = useMemo(
    () => ({ resultIndex }),
    [resultIndex],
  );

  const handleSarifLocationClicked = useMemo(
    () => updateSelectionCallback(resultKey),
    [resultKey, updateSelectionCallback],
  );
  const handleDropdownClick = useCallback(
    (e: React.MouseEvent) => {
      const indices =
        Keys.getAllPaths(result).length === 1
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

  const currentResultExpanded = expanded.has(Keys.keyToString(resultKey));
  return (
    <>
      <tr
        ref={scroller.ref(resultRowIsSelected)}
        {...selectableZebraStripe(resultRowIsSelected, resultIndex)}
      >
        {result.codeFlows === undefined ? (
          <>
            <td className="vscode-codeql__icon-cell">{info}</td>
            <td colSpan={3}>{msg}</td>
          </>
        ) : (
          <>
            <AlertTableDropdownIndicatorCell
              expanded={currentResultExpanded}
              onClick={handleDropdownClick}
            />
            <td className="vscode-codeql__icon-cell">{listUnordered}</td>
            <td colSpan={2}>{msg}</td>
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
        Keys.getAllPaths(result).map((path, pathIndex) => (
          <AlertTablePathRow
            key={`${resultIndex}-${pathIndex}`}
            {...props}
            path={path}
            pathIndex={pathIndex}
            currentPathExpanded={expanded.has(
              Keys.keyToString({ resultIndex, pathIndex }),
            )}
          />
        ))}
    </>
  );
}
