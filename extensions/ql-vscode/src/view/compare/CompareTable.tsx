import type {
  SetComparisonQueryInfoMessage,
  SetComparisonsMessage,
  UserSettings,
} from "../../common/interface-types";
import { className } from "../results/result-table-utils";
import { vscode } from "../vscode-api";
import TextButton from "../common/TextButton";
import { styled } from "styled-components";
import { RawCompareResultTable } from "./RawCompareResultTable";
import { InterpretedCompareResultTable } from "./InterpretedCompareResultTable";

interface Props {
  queryInfo: SetComparisonQueryInfoMessage;
  comparison: SetComparisonsMessage;
  userSettings: UserSettings;
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

export default function CompareTable({
  queryInfo,
  comparison,
  userSettings,
}: Props) {
  const result = comparison.result!;

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
              {queryInfo.stats.fromQuery?.name}
            </OpenButton>
          </td>
          <td>
            <OpenButton onClick={() => openQuery("to")}>
              {queryInfo.stats.toQuery?.name}
            </OpenButton>
          </td>
        </tr>
        <tr>
          <td>{queryInfo.stats.fromQuery?.time}</td>
          <td>{queryInfo.stats.toQuery?.time}</td>
        </tr>
        <tr>
          <th>{result.from.length} rows removed</th>
          <th>{result.to.length} rows added</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            {result.kind === "raw" && (
              <RawCompareResultTable
                columns={result.columns}
                schemaName={comparison.currentResultSetName}
                rows={result.from}
                databaseUri={queryInfo.databaseUri}
                className={className}
              />
            )}
            {result.kind === "interpreted" && (
              <InterpretedCompareResultTable
                results={result.from}
                userSettings={userSettings}
                databaseUri={queryInfo.databaseUri}
                sourceLocationPrefix={result.sourceLocationPrefix}
              />
            )}
          </td>
          <td>
            {result.kind === "raw" && (
              <RawCompareResultTable
                columns={result.columns}
                schemaName={comparison.currentResultSetName}
                rows={result.to}
                databaseUri={queryInfo.databaseUri}
                className={className}
              />
            )}
            {result.kind === "interpreted" && (
              <InterpretedCompareResultTable
                results={result.to}
                userSettings={userSettings}
                databaseUri={queryInfo.databaseUri}
                sourceLocationPrefix={result.sourceLocationPrefix}
              />
            )}
          </td>
        </tr>
      </tbody>
    </Table>
  );
}
