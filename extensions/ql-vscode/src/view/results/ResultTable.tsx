import { AlertTable } from "./AlertTable";
import { Graph } from "./Graph";
import { RawTable } from "./RawTable";
import type { ResultTableProps } from "./result-table-utils";
import { AlertTableNoResults } from "./AlertTableNoResults";
import { AlertTableHeader } from "./AlertTableHeader";
import { SelectionFilterNoResults } from "./SelectionFilterNoResults";

export function ResultTable(props: ResultTableProps) {
  const {
    resultSet,
    userSettings,
    selectionFilter,
    filteredRawRows,
    filteredSarifResults,
  } = props;

  const filteredCount = filteredRawRows?.length ?? filteredSarifResults?.length;
  // When filtering is active and the filtered results are empty, show a
  // message instead of forwarding to child tables (which would misleadingly
  // say the query returned no results).
  if (selectionFilter && filteredCount === 0) {
    return (
      <SelectionFilterNoResults
        sourceArchiveRelationship={selectionFilter.sourceArchiveRelationship}
      />
    );
  }

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
