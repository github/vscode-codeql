import { sendTelemetry } from "../common/telemetry";
import type { Column, Row } from "../../common/raw-result-types";
import RawTableHeader from "../results/RawTableHeader";
import RawTableRow from "../results/RawTableRow";

interface Props {
  columns: readonly Column[];
  schemaName: string;
  rows: Row[];
  databaseUri: string;

  className?: string;
}

export function RawCompareResultTable({
  columns,
  schemaName,
  rows,
  databaseUri,
  className,
}: Props) {
  return (
    <table className={className}>
      <RawTableHeader
        columns={columns}
        schemaName={schemaName}
        preventSort={true}
      />
      <tbody>
        {rows.map((row, rowIndex) => (
          <RawTableRow
            key={rowIndex}
            rowIndex={rowIndex}
            row={row}
            databaseUri={databaseUri}
            onSelected={() => {
              sendTelemetry("comapre-view-result-clicked");
            }}
          />
        ))}
      </tbody>
    </table>
  );
}
