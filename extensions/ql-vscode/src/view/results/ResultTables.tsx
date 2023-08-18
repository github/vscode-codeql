import * as React from "react";
import {
  DatabaseInfo,
  Interpretation,
  RawResultsSortState,
  QueryMetadata,
  ResultsPaths,
  InterpretedResultsSortState,
  ResultSet,
  ALERTS_TABLE_NAME,
  GRAPH_TABLE_NAME,
  SELECT_TABLE_NAME,
  getDefaultResultSetName,
  ParsedResultSets,
  IntoResultsViewMsg,
} from "../../common/interface-types";
import { tableHeaderClassName } from "./result-table-utils";
import { vscode } from "../vscode-api";
import { sendTelemetry } from "../common/telemetry";
import { ResultTable } from "./ResultTable";
import { ResultTablesHeader } from "./ResultTablesHeader";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ResultCount } from "./ResultCount";
import { ProblemsViewCheckbox } from "./ProblemsViewCheckbox";

/**
 * Properties for the `ResultTables` component.
 */
interface ResultTablesProps {
  parsedResultSets: ParsedResultSets;
  rawResultSets: readonly ResultSet[];
  interpretation: Interpretation | undefined;
  database: DatabaseInfo;
  metadata?: QueryMetadata;
  resultsPath: string;
  origResultsPaths: ResultsPaths;
  sortStates: Map<string, RawResultsSortState>;
  interpretedSortState?: InterpretedResultsSortState;
  isLoadingNewResults: boolean;
  queryName: string;
  queryPath: string;
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
      // FIXME: The values of version, columns, tupleCount are
      // unused stubs because a InterpretedResultSet schema isn't used the
      // same way as a RawResultSet. Probably should pull `name` field
      // out.
      schema: {
        name: tableName,
        rows: 1,
        columns: [],
      },
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
    metadata,
    origResultsPaths,
    isLoadingNewResults,
    sortStates,
  } = props;

  const [selectedTable, setSelectedTable] = useState(
    parsedResultSets.selectedTable ||
      getDefaultResultSet(getResultSets(rawResultSets, interpretation)),
  );
  const [problemsViewSelected, setProblemsViewSelected] = useState(false);

  const handleMessage = useCallback((msg: IntoResultsViewMsg): void => {
    switch (msg.t) {
      case "untoggleShowProblems":
        setProblemsViewSelected(false);
        break;

      default:
      // noop
    }
  }, []);

  const vscodeMessageHandler = useCallback(
    (evt: MessageEvent): void => {
      // sanitize origin
      const origin = evt.origin.replace(/\n|\r/g, "");
      evt.origin === window.origin
        ? handleMessage(evt.data as IntoResultsViewMsg)
        : console.error(`Invalid event origin ${origin}`);
    },
    [handleMessage],
  );

  // TODO: Duplicated from ResultsApp.tsx consider a way to
  // avoid this duplication
  useEffect(() => {
    window.addEventListener("message", vscodeMessageHandler);

    return () => {
      window.removeEventListener("message", vscodeMessageHandler);
    };
  }, [vscodeMessageHandler]);

  useEffect(() => {
    const resultSetExists =
      parsedResultSets.resultSetNames.some((v) => selectedTable === v) ||
      getResultSets(rawResultSets, interpretation).some(
        (v) => selectedTable === v.schema.name,
      );

    // If the selected result set does not exist, select the default result set.
    if (!resultSetExists) {
      setSelectedTable(
        parsedResultSets.selectedTable ||
          getDefaultResultSet(getResultSets(rawResultSets, interpretation)),
      );
    }
  }, [parsedResultSets, interpretation, rawResultSets, selectedTable]);

  const onTableSelectionChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      const selectedTable = event.target.value;
      vscode.postMessage({
        t: "changePage",
        pageNumber: 0,
        selectedTable,
      });
      sendTelemetry("local-results-table-selection");
    },
    [],
  );

  const handleCheckboxChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked === problemsViewSelected) {
        // no change
        return;
      }
      setProblemsViewSelected(e.target.checked);
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
    [database, metadata, origResultsPaths, problemsViewSelected, resultsPath],
  );

  const offset = parsedResultSets.pageNumber * parsedResultSets.pageSize;

  const resultSets = useMemo(
    () => getResultSets(rawResultSets, interpretation),
    [interpretation, rawResultSets],
  );
  const resultSetNames = getResultSetNames(interpretation, parsedResultSets);

  const resultSet = useMemo(
    () =>
      resultSets.find((resultSet) => resultSet.schema.name === selectedTable),
    [resultSets, selectedTable],
  );
  const nonemptyRawResults = resultSets.some(
    (resultSet) => resultSet.t === "RawResultSet" && resultSet.rows.length > 0,
  );

  const resultSetOptions = resultSetNames.map((name) => (
    <option key={name} value={name}>
      {name}
    </option>
  ));
  return (
    <div>
      <ResultTablesHeader {...props} selectedTable={selectedTable} />
      <div className={tableHeaderClassName}></div>
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
      {resultSet && (
        <ResultTable
          key={resultSet.schema.name}
          resultSet={resultSet}
          databaseUri={database.databaseUri}
          resultsPath={resultsPath}
          sortState={sortStates.get(resultSet.schema.name)}
          nonemptyRawResults={nonemptyRawResults}
          showRawResults={() => {
            setSelectedTable(SELECT_TABLE_NAME);
            sendTelemetry("local-results-show-raw-results");
          }}
          offset={offset}
        />
      )}
    </div>
  );
}

function getDefaultResultSet(resultSets: readonly ResultSet[]): string {
  return getDefaultResultSetName(
    resultSets.map((resultSet) => resultSet.schema.name),
  );
}
