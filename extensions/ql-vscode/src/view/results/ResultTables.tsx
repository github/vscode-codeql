import type {
  DatabaseInfo,
  EditorSelection,
  FileFilteredResults,
  Interpretation,
  RawResultsSortState,
  QueryMetadata,
  ResultsPaths,
  InterpretedResultsSortState,
  ResultSet,
  ParsedResultSets,
  UserSettings,
} from "../../common/interface-types";
import {
  ALERTS_TABLE_NAME,
  GRAPH_TABLE_NAME,
  SELECT_TABLE_NAME,
} from "../../common/interface-types";
import { tableHeaderClassName } from "./result-table-utils";
import { vscode } from "../vscode-api";
import { sendTelemetry } from "../common/telemetry";
import { ResultTable } from "./ResultTable";
import { ResultTablesHeader } from "./ResultTablesHeader";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ResultCount } from "./ResultCount";
import { ProblemsViewCheckbox } from "./ProblemsViewCheckbox";
import { SelectionFilterCheckbox } from "./SelectionFilterCheckbox";
import { assertNever } from "../../common/helpers-pure";

/**
 * Properties for the `ResultTables` component.
 */
interface ResultTablesProps {
  parsedResultSets: ParsedResultSets;
  rawResultSets: readonly ResultSet[];
  interpretation: Interpretation | undefined;
  database: DatabaseInfo;
  userSettings: UserSettings;
  metadata?: QueryMetadata;
  resultsPath: string;
  origResultsPaths: ResultsPaths;
  sortStates: Map<string, RawResultsSortState>;
  interpretedSortState?: InterpretedResultsSortState;
  isLoadingNewResults: boolean;
  queryName: string;
  queryPath: string;
  selectedTable: string;
  onSelectedTableChange: (tableName: string) => void;
  selectionFilter: EditorSelection | undefined;
  fileFilteredResults: FileFilteredResults | undefined;
  selectionFilterEnabled: boolean;
  onSelectionFilterEnabledChange: (value: boolean) => void;
  problemsViewSelected: boolean;
  onProblemsViewSelectedChange: (selected: boolean) => void;
}

const UPDATING_RESULTS_TEXT_CLASS_NAME =
  "vscode-codeql__result-tables-updating-text";

function getInterpretedTableName(interpretation: Interpretation): string {
  return interpretation.data.t === "GraphInterpretationData"
    ? GRAPH_TABLE_NAME
    : ALERTS_TABLE_NAME;
}

function getResultSetNames(
  interpretation: Interpretation | undefined,
  parsedResultSets: ParsedResultSets,
): string[] {
  return interpretation
    ? parsedResultSets.resultSetNames.concat([
        getInterpretedTableName(interpretation),
      ])
    : parsedResultSets.resultSetNames;
}

function getResultSets(
  rawResultSets: readonly ResultSet[],
  interpretation: Interpretation | undefined,
): ResultSet[] {
  const resultSets: ResultSet[] =
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore 2783 Avoid compilation error for overwriting the t property
    rawResultSets.map((rs) => ({ t: "RawResultSet", ...rs }));

  if (interpretation !== undefined) {
    const tableName = getInterpretedTableName(interpretation);
    resultSets.push({
      t: "InterpretedResultSet",
      name: tableName,
      interpretation,
    });
  }
  return resultSets;
}

/**
 * Displays multiple `ResultTable` tables, where the table to be displayed is selected by a
 * dropdown.
 */
export function ResultTables(props: ResultTablesProps) {
  const {
    parsedResultSets,
    rawResultSets,
    interpretation,
    database,
    resultsPath,
    userSettings,
    metadata,
    origResultsPaths,
    isLoadingNewResults,
    sortStates,
    selectedTable,
    onSelectedTableChange,
    selectionFilter,
    fileFilteredResults,
    selectionFilterEnabled,
    onSelectionFilterEnabledChange,
    problemsViewSelected,
    onProblemsViewSelectedChange,
  } = props;

  const onTableSelectionChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      const selectedTable = event.target.value;
      vscode.postMessage({
        t: "changePage",
        pageNumber: 0,
        selectedTable,
      });
      onSelectedTableChange(selectedTable);
      sendTelemetry("local-results-table-selection");
    },
    [onSelectedTableChange],
  );

  const handleCheckboxChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked === problemsViewSelected) {
        // no change
        return;
      }
      onProblemsViewSelectedChange(e.target.checked);
      if (e.target.checked) {
        sendTelemetry("local-results-show-results-in-problems-view");
      }
      if (resultsPath !== undefined) {
        vscode.postMessage({
          t: "toggleDiagnostics",
          origResultsPaths,
          databaseUri: database.databaseUri,
          visible: e.target.checked,
          metadata,
        });
      }
    },
    [
      database,
      metadata,
      onProblemsViewSelectedChange,
      origResultsPaths,
      problemsViewSelected,
      resultsPath,
    ],
  );

  const offset = parsedResultSets.pageNumber * parsedResultSets.pageSize;

  const resultSets = useMemo(
    () => getResultSets(rawResultSets, interpretation),
    [interpretation, rawResultSets],
  );
  const resultSetNames = getResultSetNames(interpretation, parsedResultSets);

  const resultSet = useMemo(
    () =>
      resultSets.find(
        (resultSet) => selectedTable === getResultSetName(resultSet),
      ),
    [resultSets, selectedTable],
  );
  const nonemptyRawResults = resultSets.some(
    (resultSet) =>
      resultSet.t === "RawResultSet" && resultSet.resultSet.rows.length > 0,
  );

  const resultSetOptions = resultSetNames.map((name) => (
    <option key={name} value={name}>
      {name}
    </option>
  ));

  const resultSetName = resultSet ? getResultSetName(resultSet) : undefined;

  // True if file-filtered results are still loading from the extension
  const isLoadingFilteredResults =
    selectionFilter != null && fileFilteredResults == null;

  return (
    <div>
      <ResultTablesHeader {...props} selectedTable={selectedTable} />
      <div className={tableHeaderClassName}></div>
      <div
        className={tableHeaderClassName}
        style={{ justifyContent: "flex-end" }}
      >
        <SelectionFilterCheckbox
          checked={selectionFilterEnabled}
          onChange={(e) => onSelectionFilterEnabledChange(e.target.checked)}
        />
      </div>
      <div className={tableHeaderClassName}>
        <select value={selectedTable} onChange={onTableSelectionChange}>
          {resultSetOptions}
        </select>
        <ResultCount resultSet={resultSet} />
        <ProblemsViewCheckbox
          selectedTable={selectedTable}
          problemsViewSelected={problemsViewSelected}
          handleCheckboxChanged={handleCheckboxChanged}
        />
        {isLoadingNewResults ? (
          <span className={UPDATING_RESULTS_TEXT_CLASS_NAME}>
            Updating results…
          </span>
        ) : null}
      </div>
      {isLoadingFilteredResults && <span>Loading filtered results…</span>}
      {!isLoadingFilteredResults && resultSet && resultSetName && (
        <ResultTable
          key={resultSetName}
          resultSet={resultSet}
          userSettings={userSettings}
          databaseUri={database.databaseUri}
          resultsPath={resultsPath}
          sortState={sortStates.get(resultSetName)}
          nonemptyRawResults={nonemptyRawResults}
          showRawResults={() => {
            onSelectedTableChange(SELECT_TABLE_NAME);
            sendTelemetry("local-results-show-raw-results");
          }}
          offset={offset}
          selectionFilter={selectionFilter}
        />
      )}
    </div>
  );
}

function getResultSetName(resultSet: ResultSet): string {
  switch (resultSet.t) {
    case "RawResultSet":
      return resultSet.resultSet.name;
    case "InterpretedResultSet":
      return resultSet.name;
    default:
      assertNever(resultSet);
  }
}
