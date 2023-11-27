import * as React from "react";

import { SetComparisonsMessage } from "../../common/interface-types";
import RawTableHeader from "../results/RawTableHeader";
import { className } from "../results/result-table-utils";
import RawTableRow from "../results/RawTableRow";
import { vscode } from "../vscode-api";
import { sendTelemetry } from "../common/telemetry";
import TextButton from "../common/TextButton";
import { styled } from "styled-components";
import { Row } from "../../common/raw-result-types";

interface Props {
  comparison: SetComparisonsMessage;
}

const OpenButton = styled(TextButton)`
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
`;

export default function CompareTable(props: Props) {
  const comparison = props.comparison;
  const rows = props.comparison.rows!;

  async function openQuery(kind: "from" | "to") {
    vscode.postMessage({
      t: "openQuery",
      kind,
    });
  }

  function createRows(rows: Row[], databaseUri: string) {
    return (
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
    );
  }

  return (
    <table className="vscode-codeql__compare-body">
      <thead>
        <tr>
          <td>
            <OpenButton onClick={() => openQuery("from")}>
              {comparison.stats.fromQuery?.name}
            </OpenButton>
          </td>
          <td>
            <OpenButton onClick={() => openQuery("to")}>
              {comparison.stats.toQuery?.name}
            </OpenButton>
          </td>
        </tr>
        <tr>
          <td>{comparison.stats.fromQuery?.time}</td>
          <td>{comparison.stats.toQuery?.time}</td>
        </tr>
        <tr>
          <th>{rows.from.length} rows removed</th>
          <th>{rows.to.length} rows added</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <table className={className}>
              <RawTableHeader
                columns={comparison.columns}
                schemaName={comparison.currentResultSetName}
                preventSort={true}
              />
              {createRows(rows.from, comparison.databaseUri)}
            </table>
          </td>
          <td>
            <table className={className}>
              <RawTableHeader
                columns={comparison.columns}
                schemaName={comparison.currentResultSetName}
                preventSort={true}
              />
              {createRows(rows.to, comparison.databaseUri)}
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
