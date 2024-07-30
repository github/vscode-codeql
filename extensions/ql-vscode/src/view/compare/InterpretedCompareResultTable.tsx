import type { Result, Run } from "sarif";
import { AlertTable } from "../results/AlertTable";
import type { UserSettings } from "../../common/interface-types";

type Props = {
  results: Result[];
  databaseUri: string;
  sourceLocationPrefix: string;
  run?: Run;
  userSettings: UserSettings;
};

export const InterpretedCompareResultTable = ({
  results,
  databaseUri,
  sourceLocationPrefix,
  userSettings,
}: Props) => {
  return (
    <AlertTable
      results={results}
      userSettings={userSettings}
      databaseUri={databaseUri}
      sourceLocationPrefix={sourceLocationPrefix}
      header={
        <thead>
          <tr>
            <th colSpan={2}></th>
            <th className={`vscode-codeql__alert-message-cell`} colSpan={4}>
              Message
            </th>
          </tr>
        </thead>
      }
    />
  );
};
