import * as React from "react";
import { ResultRow } from "../../pure/bqrs-cli-types";
import { selectedRowClassName, zebraStripe } from "./result-table-utils";
import RawTableValue from "./RawTableValue";
import { ScrollIntoViewHelper } from "./scroll-into-view-helper";

interface Props {
  rowIndex: number;
  row: ResultRow;
  databaseUri: string;
  className?: string;
  selectedColumn?: number;
  onSelected?: (row: number, column: number) => void;
  scroller?: ScrollIntoViewHelper;
}

export default function RawTableRow(props: Props) {
  return (
    <tr
      key={props.rowIndex}
      {...zebraStripe(props.rowIndex, props.className || "")}
    >
      <td key={-1}>{props.rowIndex + 1}</td>

      {props.row.map((value, columnIndex) => {
        const isSelected = props.selectedColumn === columnIndex;
        return (
          <td
            ref={props.scroller?.ref(isSelected)}
            key={columnIndex}
            {...(isSelected ? { className: selectedRowClassName } : {})}
          >
            <RawTableValue
              value={value}
              databaseUri={props.databaseUri}
              onSelected={() => props.onSelected?.(props.rowIndex, columnIndex)}
            />
          </td>
        );
      })}
    </tr>
  );
}
