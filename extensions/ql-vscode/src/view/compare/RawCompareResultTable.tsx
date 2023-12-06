import * as React from "react";
import { ResultRow } from "../../common/bqrs-cli-types";
import { sendTelemetry } from "../common/telemetry";
import RawTableHeader from "../results/RawTableHeader";
import RawTableRow from "../results/RawTableRow";

interface Props {
  columns: ReadonlyArray<{ name?: string }>;
  schemaName: string;
  rows: ResultRow[];
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
