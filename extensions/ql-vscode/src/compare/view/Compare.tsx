import * as React from "react";
import { useState, useEffect } from "react";
import * as Rdom from "react-dom";

import RawTableHeader from "../../view/RawTableHeader";
import {
  ToCompareViewMessage,
  SetComparisonsMessage,
} from "../../interface-types";
import CompareSelector from "./CompareSelector";
import { vscode } from "../../view/vscode-api";
import RawTableRow from "../../view/RawTableRow";
import { ResultRow } from "../../adapt";
import { className } from "../../view/result-table-utils";

const emptyComparison: SetComparisonsMessage = {
  t: "setComparisons",
  stats: {},
  rows: {
    from: [],
    to: [],
  },
  columns: [],
  commonResultSetNames: [],
  currentResultSetName: "",
  datebaseUri: "",
};

export function Compare(props: {}): JSX.Element {
  const [comparison, setComparison] = useState<SetComparisonsMessage>(
    emptyComparison
  );

  useEffect(() => {
    window.addEventListener("message", (evt: MessageEvent) => {
      const msg: ToCompareViewMessage = evt.data;
      switch (msg.t) {
        case "setComparisons":
          setComparison(msg);
      }
    });
  });
  if (!comparison) {
    return <div>Waiting for results to load.</div>;
  }

  try {
    return (
      <>
        <div className="vscode-codeql__compare-header">
          <div>Table to compare:</div>
          <CompareSelector
            availableResultSets={comparison.commonResultSetNames}
            currentResultSetName={comparison.currentResultSetName}
            updateResultSet={(newResultSetName: string) =>
              vscode.postMessage({ t: "changeCompare", newResultSetName })
            }
          />
        </div>
        <table className="vscode-codeql__compare-body">
          <thead>
            <tr>
              <td>
                <a
                  onClick={() => openQuery("from")}
                  className="vscode-codeql__compare-open"
                >
                  {comparison.stats.fromQuery?.name}
                </a>
              </td>
              <td>
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
              <th>{comparison.rows.from.length} rows removed</th>
              <th>{comparison.rows.to.length} rows added</th>
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
                  {createRows(comparison.rows.from, comparison.datebaseUri)}
                </table>
              </td>
              <td>
                <table className={className}>
                  <RawTableHeader
                    columns={comparison.columns}
                    schemaName={comparison.currentResultSetName}
                    preventSort={true}
                  />
                  {createRows(comparison.rows.to, comparison.datebaseUri)}
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </>
    );
  } catch (err) {
    console.error(err);
    return <div>Error!</div>;
  }
}

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
        />
      ))}
    </tbody>
  );
}

Rdom.render(
  <Compare />,
  document.getElementById("root"),
  // Post a message to the extension when fully loaded.
  () => vscode.postMessage({ t: "compareViewLoaded" })
);
