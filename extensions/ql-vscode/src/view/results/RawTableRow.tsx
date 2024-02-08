import { selectedRowClassName, zebraStripe } from "./result-table-utils";
import RawTableValue from "./RawTableValue";
import type { Row } from "../../common/raw-result-types";

interface Props {
  rowIndex: number;
  row: Row;
  databaseUri: string;
  className?: string;
  selectedColumn?: number;
  selectedItemRef?: React.Ref<HTMLTableCellElement>;
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
