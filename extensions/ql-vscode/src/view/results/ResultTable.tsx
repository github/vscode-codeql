import { AlertTable } from "./AlertTable";
import { Graph } from "./Graph";
import { RawTable } from "./RawTable";
import type { ResultTableProps } from "./result-table-utils";
import { AlertTableNoResults } from "./AlertTableNoResults";
import { AlertTableHeader } from "./AlertTableHeader";

export function ResultTable(props: ResultTableProps) {
  const { resultSet, userSettings, filteredRawRows, filteredSarifResults } =
    props;
  switch (resultSet.t) {
    case "RawResultSet": {
      const filteredResultSet = {
        ...resultSet.resultSet,
        rows: filteredRawRows ?? resultSet.resultSet.rows,
      };
      return <RawTable {...props} resultSet={filteredResultSet} />;
    }
    case "InterpretedResultSet": {
      const data = resultSet.interpretation.data;
      switch (data.t) {
        case "SarifInterpretationData": {
          const results = filteredSarifResults ?? data.runs[0].results ?? [];
          return (
            <AlertTable
              results={results}
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
