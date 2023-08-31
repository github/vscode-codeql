import * as React from "react";
import { ResultRow } from "../../common/bqrs-cli-types";
import { selectedRowClassName, zebraStripe } from "./result-table-utils";
import RawTableValue from "./RawTableValue";

interface Props {
  rowIndex: number;
  row: ResultRow;
  databaseUri: string;
  className?: string;
  selectedColumn?: number;
  selectedItemRef?: React.Ref<any>;
  onSelected?: (row: number, column: number) => void;
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
            ref={isSelected ? props.selectedItemRef : undefined}
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
