import * as React from "react";
import * as Sarif from "sarif";
import * as Keys from "./result-keys";
import { listUnordered } from "./octicons";
import { ScrollIntoViewHelper } from "./scroll-into-view-helper";
import { selectableZebraStripe } from "./result-table-utils";
import { AlertTableDropdownIndicatorCell } from "./AlertTableDropdownIndicatorCell";
import { useMemo } from "react";

interface Props {
  result: Sarif.Result;
  resultIndex: number;
  currentResultExpanded: boolean;
  selectedItem: undefined | Keys.ResultKey;
  toggler: (keys: Keys.ResultKey[]) => (e: React.MouseEvent) => void;
  scroller: ScrollIntoViewHelper;
  msg: JSX.Element;
  locationCells: JSX.Element;
}

export function AlertTableResultRow(props: Props) {
  const {
    result,
    resultIndex,
    currentResultExpanded,
    selectedItem,
    toggler,
    scroller,
    msg,
    locationCells,
  } = props;

  const handleDropdownClick = useMemo(() => {
    const resultKey: Keys.Result = { resultIndex };
    const indices =
      Keys.getAllPaths(result).length === 1
        ? [resultKey, { ...resultKey, pathIndex: 0 }]
        : /* if there's exactly one path, auto-expand
           * the path when expanding the result */
          [resultKey];
    return toggler(indices);
  }, [result, resultIndex, toggler]);

  const resultRowIsSelected =
    selectedItem?.resultIndex === resultIndex &&
    selectedItem.pathIndex === undefined;

  return (
    <tr
      ref={scroller.ref(resultRowIsSelected)}
      {...selectableZebraStripe(resultRowIsSelected, resultIndex)}
      key={resultIndex}
    >
      <AlertTableDropdownIndicatorCell
        expanded={currentResultExpanded}
        onClick={handleDropdownClick}
      />
      <td className="vscode-codeql__icon-cell">{listUnordered}</td>
      <td colSpan={2}>{msg}</td>
      {locationCells}
    </tr>
  );
}
