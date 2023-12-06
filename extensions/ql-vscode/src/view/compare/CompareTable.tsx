import * as React from "react";

import { SetComparisonsMessage } from "../../common/interface-types";
import { className } from "../results/result-table-utils";
import { vscode } from "../vscode-api";
import TextButton from "../common/TextButton";
import { styled } from "styled-components";
import { RawCompareResultTable } from "./RawCompareResultTable";

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
            <RawCompareResultTable
              columns={result.columns}
              schemaName={comparison.currentResultSetName}
              rows={result.from}
              databaseUri={comparison.databaseUri}
              className={className}
            />
          </td>
          <td>
            <RawCompareResultTable
              columns={result.columns}
              schemaName={comparison.currentResultSetName}
              rows={result.to}
              databaseUri={comparison.databaseUri}
              className={className}
            />
          </td>
        </tr>
      </tbody>
    </Table>
  );
}
