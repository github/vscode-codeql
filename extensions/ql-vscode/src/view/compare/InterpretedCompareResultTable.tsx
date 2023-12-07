import * as React from "react";
import * as sarif from "sarif";
import { AlertTable } from "../results/AlertTable";

type Props = {
  results: sarif.Result[];
  databaseUri: string;
  sourceLocationPrefix: string;
};

export const InterpretedCompareResultTable = ({
  results,
  databaseUri,
  sourceLocationPrefix,
}: Props) => {
  return (
    <AlertTable
      results={results}
      databaseUri={databaseUri}
      sourceLocationPrefix={sourceLocationPrefix}
      header={
        <thead>
          <tr>
            <th colSpan={2}></th>
            <th className={`vscode-codeql__alert-message-cell`} colSpan={3}>
              Message
            </th>
          </tr>
        </thead>
      }
    />
  );
};
