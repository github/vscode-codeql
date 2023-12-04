import * as React from "react";

import { SetComparisonsMessage } from "../../common/interface-types";
import { className } from "../results/result-table-utils";
import { vscode } from "../vscode-api";
import TextButton from "../common/TextButton";
import { styled } from "styled-components";
import { RawCompareResultTable } from "./RawCompareResultTable";
import { InterpretedCompareResultTable } from "./InterpretedCompareResultTable";

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
  const result = props.comparison.result!;

  async function openQuery(kind: "from" | "to") {
    vscode.postMessage({
      t: "openQuery",
      kind,
    });
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
          <th>{result.from.length} rows removed</th>
          <th>{result.to.length} rows added</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            {result.type === "raw" && (
              <RawCompareResultTable
                rows={result.from}
                columns={result.columns}
                schemaName={comparison.currentResultSetName}
                databaseUri={comparison.databaseUri}
                className={className}
              />
            )}
            {result.type === "interpreted" && (
              <InterpretedCompareResultTable
                results={result.from}
                databaseUri={comparison.databaseUri}
                sourceLocationPrefix={result.sourceLocationPrefix}
                className={className}
              />
            )}
          </td>
          <td>
            <table className={className}>
              {result.type === "raw" && (
                <RawCompareResultTable
                  rows={result.to}
                  columns={result.columns}
                  schemaName={comparison.currentResultSetName}
                  databaseUri={comparison.databaseUri}
                  className={className}
                />
              )}
              {result.type === "interpreted" && (
                <InterpretedCompareResultTable
                  results={result.to}
                  databaseUri={comparison.databaseUri}
                  sourceLocationPrefix={result.sourceLocationPrefix}
                  className={className}
                />
              )}
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
