import * as React from "react";

import { SetComparisonsMessage } from "../../common/interface-types";
import RawTableHeader from "../results/RawTableHeader";
import { className } from "../results/result-table-utils";
import { ResultRow } from "../../common/bqrs-cli-types";
import RawTableRow from "../results/RawTableRow";
import { vscode } from "../vscode-api";
import { sendTelemetry } from "../common/telemetry";

interface Props {
  comparison: SetComparisonsMessage;
}

export default function CompareTable(props: Props) {
  const comparison = props.comparison;
  const rows = props.comparison.rows!;

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
    <table className="vscode-codeql__compare-body">
      <thead>
        <tr>
          <td>
            {/*
              eslint-disable-next-line
              jsx-a11y/anchor-is-valid,
              jsx-a11y/click-events-have-key-events,
              jsx-a11y/no-static-element-interactions
            */}
            <a
              onClick={() => openQuery("from")}
              className="vscode-codeql__compare-open"
            >
              {comparison.stats.fromQuery?.name}
            </a>
          </td>
          <td>
            {/*
              eslint-disable-next-line
              jsx-a11y/anchor-is-valid,
              jsx-a11y/click-events-have-key-events,
              jsx-a11y/no-static-element-interactions
            */}
            <a
              onClick={() => openQuery("to")}
              className="vscode-codeql__compare-open"
            >
              {comparison.stats.toQuery?.name}
            </a>
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
