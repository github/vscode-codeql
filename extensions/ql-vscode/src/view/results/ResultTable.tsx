import { AlertTable } from "./AlertTable";
import { Graph } from "./Graph";
import { RawTable } from "./RawTable";
import type { ResultTableProps } from "./result-table-utils";
import { AlertTableNoResults } from "./AlertTableNoResults";
import { AlertTableHeader } from "./AlertTableHeader";

export function ResultTable(props: ResultTableProps) {
  const { resultSet, userSettings } = props;
  switch (resultSet.t) {
    case "RawResultSet":
      return <RawTable {...props} resultSet={resultSet.resultSet} />;
    case "InterpretedResultSet": {
      const data = resultSet.interpretation.data;
      switch (data.t) {
        case "SarifInterpretationData": {
          return (
            <AlertTable
              results={data.runs[0].results ?? []}
              databaseUri={props.databaseUri}
              sourceLocationPrefix={
                resultSet.interpretation.sourceLocationPrefix
              }
              run={data.runs[0]}
              userSettings={userSettings}
              numTruncatedResults={resultSet.interpretation.numTruncatedResults}
              header={<AlertTableHeader sortState={data.sortState} />}
              noResults={
                <AlertTableNoResults
                  nonemptyRawResults={props.nonemptyRawResults}
                  showRawResults={props.showRawResults}
                />
              }
            />
          );
        }
        case "GraphInterpretationData": {
          return (
            <Graph
              graphData={data?.dot[props.offset]}
              databaseUri={props.databaseUri}
            />
          );
        }
      }
    }
  }
}
