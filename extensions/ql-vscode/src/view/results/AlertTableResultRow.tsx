import * as React from "react";
import * as Sarif from "sarif";
import * as Keys from "./result-keys";
import { listUnordered } from "./octicons";
import { ScrollIntoViewHelper } from "./scroll-into-view-helper";
import { selectableZebraStripe } from "./result-table-utils";
import { AlertTableDropdownIndicatorCell } from "./AlertTableDropdownIndicatorCell";

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

  const resultKey: Keys.Result = { resultIndex };

  const paths: Sarif.ThreadFlow[] = Keys.getAllPaths(result);
  const indices =
    paths.length === 1
      ? [resultKey, { ...resultKey, pathIndex: 0 }]
      : /* if there's exactly one path, auto-expand
         * the path when expanding the result */
        [resultKey];

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
        onClick={toggler(indices)}
      />
      <td className="vscode-codeql__icon-cell">{listUnordered}</td>
      <td colSpan={2}>{msg}</td>
      {locationCells}
    </tr>
  );
}
