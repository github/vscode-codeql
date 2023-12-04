import * as React from "react";
import { Column, ResultRow } from "../../common/bqrs-cli-types";
import RawTableHeader from "../results/RawTableHeader";
import RawTableRow from "../results/RawTableRow";
import { sendTelemetry } from "../common/telemetry";

type Props = {
  rows: ResultRow[];
  columns: readonly Column[];
  schemaName: string;
  databaseUri: string;

  className?: string;
};

export const RawCompareResultTable = ({
  rows,
  columns,
  schemaName,
  databaseUri,
  className,
}: Props) => {
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
};
