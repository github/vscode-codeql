import * as React from "react";

import { SetComparisonsMessage } from "../../common/interface-types";
import RawTableHeader from "../results/RawTableHeader";
import { className } from "../results/result-table-utils";
import { ResultRow } from "../../common/bqrs-cli-types";
import RawTableRow from "../results/RawTableRow";
import { vscode } from "../vscode-api";
import { sendTelemetry } from "../common/telemetry";
import TextButton from "../common/TextButton";
import { styled } from "styled-components";

interface Props {
  comparison: SetComparisonsMessage;
}

const OpenButton = styled(TextButton)`
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
`;

const Table = styled.table`
  margin: 20px 0;
  width: 100%;

  & > tbody {
    vertical-align: top;
  }
`;

export default function CompareTable(props: Props) {
  const comparison = props.comparison;
  const result = props.comparison.result!;

  async function openQuery(kind: "from" | "to") {
    vscode.postMessage({
      t: "openQuery",
      kind,
    });
  }

  function createRows(rows: ResultRow[], databaseUri: string) {
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
    <Table>
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
          <th>{result.from.length} rows removed</th>
          <th>{result.to.length} rows added</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <table className={className}>
              <RawTableHeader
                columns={result.columns}
                schemaName={comparison.currentResultSetName}
                preventSort={true}
              />
              {createRows(result.from, comparison.databaseUri)}
            </table>
          </td>
          <td>
            <table className={className}>
              <RawTableHeader
                columns={result.columns}
                schemaName={comparison.currentResultSetName}
                preventSort={true}
              />
              {createRows(result.to, comparison.databaseUri)}
            </table>
          </td>
        </tr>
      </tbody>
    </Table>
  );
}
