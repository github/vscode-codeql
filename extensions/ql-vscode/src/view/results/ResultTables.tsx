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
import {
  tableHeaderClassName,
  tableHeaderItemClassName,
  toggleDiagnosticsClassName,
  alertExtrasClassName,
} from "./result-table-utils";
import { vscode } from "../vscode-api";
import { sendTelemetry } from "../common/telemetry";
import { ResultTable } from "./ResultTable";
import { ResultTablesHeader } from "./ResultTablesHeader";

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

/**
 * State for the `ResultTables` component.
 */
interface ResultTablesState {
  selectedTable: string; // name of selected result set
  problemsViewSelected: boolean;
}

const UPDATING_RESULTS_TEXT_CLASS_NAME =
  "vscode-codeql__result-tables-updating-text";

function getResultCount(resultSet: ResultSet): number {
  switch (resultSet.t) {
    case "RawResultSet":
      return resultSet.schema.rows;
    case "InterpretedResultSet":
      return resultSet.interpretation.numTotalResults;
  }
}

function renderResultCountString(resultSet: ResultSet): JSX.Element {
  const resultCount = getResultCount(resultSet);
  return (
    <span className={tableHeaderItemClassName}>
      {resultCount} {resultCount === 1 ? "result" : "results"}
    </span>
  );
}

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
export class ResultTables extends React.Component<
  ResultTablesProps,
  ResultTablesState
> {
  constructor(props: ResultTablesProps) {
    super(props);
    const selectedTable =
      props.parsedResultSets.selectedTable ||
      getDefaultResultSet(
        getResultSets(props.rawResultSets, props.interpretation),
      );
    this.state = {
      selectedTable,
      problemsViewSelected: false,
    };
  }

  handleMessage(msg: IntoResultsViewMsg): void {
    switch (msg.t) {
      case "untoggleShowProblems":
        this.setState({
          problemsViewSelected: false,
        });
        break;

      default:
      // noop
    }
  }

  private vscodeMessageHandler(evt: MessageEvent) {
    // sanitize origin
    const origin = evt.origin.replace(/\n|\r/g, "");
    evt.origin === window.origin
      ? this.handleMessage(evt.data as IntoResultsViewMsg)
      : console.error(`Invalid event origin ${origin}`);
  }

  // TODO: Duplicated from results.tsx consider a way to
  // avoid this duplication
  componentDidMount(): void {
    this.vscodeMessageHandler = this.vscodeMessageHandler.bind(this);
    window.addEventListener("message", this.vscodeMessageHandler);
  }

  componentWillUnmount(): void {
    if (this.vscodeMessageHandler) {
      window.removeEventListener("message", this.vscodeMessageHandler);
    }
  }

  componentDidUpdate(
    prevProps: Readonly<ResultTablesProps>,
    prevState: Readonly<ResultTablesState>,
    snapshot?: any,
  ) {
    const resultSetExists =
      this.props.parsedResultSets.resultSetNames.some(
        (v) => this.state.selectedTable === v,
      ) ||
      getResultSets(this.props.rawResultSets, this.props.interpretation).some(
        (v) => this.state.selectedTable === v.schema.name,
      );

    // If the selected result set does not exist, select the default result set.
    if (!resultSetExists) {
      this.setState((state, props) => {
        const selectedTable =
          props.parsedResultSets.selectedTable ||
          getDefaultResultSet(
            getResultSets(props.rawResultSets, props.interpretation),
          );

        return { selectedTable };
      });
    }
  }

  private onTableSelectionChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    const selectedTable = event.target.value;
    vscode.postMessage({
      t: "changePage",
      pageNumber: 0,
      selectedTable,
    });
    sendTelemetry("local-results-table-selection");
  };

  private alertTableExtras(): JSX.Element | undefined {
    const { database, resultsPath, metadata, origResultsPaths } = this.props;
    const handleCheckboxChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked === this.state.problemsViewSelected) {
        // no change
        return;
      }
      this.setState({
        problemsViewSelected: e.target.checked,
      });
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
    };

    return (
      <div className={alertExtrasClassName}>
        <div className={toggleDiagnosticsClassName}>
          <input
            type="checkbox"
            id="toggle-diagnostics"
            name="toggle-diagnostics"
            onChange={handleCheckboxChanged}
            checked={this.state.problemsViewSelected}
          />
          <label htmlFor="toggle-diagnostics">
            Show results in Problems view
          </label>
        </div>
      </div>
    );
  }

  getOffset(): number {
    const { parsedResultSets } = this.props;
    return parsedResultSets.pageNumber * parsedResultSets.pageSize;
  }

  render(): React.ReactNode {
    const { selectedTable } = this.state;
    const resultSets = getResultSets(
      this.props.rawResultSets,
      this.props.interpretation,
    );
    const resultSetNames = getResultSetNames(
      this.props.interpretation,
      this.props.parsedResultSets,
    );

    const resultSet = resultSets.find(
      (resultSet) => resultSet.schema.name === selectedTable,
    );
    const nonemptyRawResults = resultSets.some(
      (resultSet) =>
        resultSet.t === "RawResultSet" && resultSet.rows.length > 0,
    );
    const numberOfResults = resultSet && renderResultCountString(resultSet);

    const resultSetOptions = resultSetNames.map((name) => (
      <option key={name} value={name}>
        {name}
      </option>
    ));
    return (
      <div>
        <ResultTablesHeader
          {...this.props}
          selectedTable={this.state.selectedTable}
        />
        <div className={tableHeaderClassName}></div>
        <div className={tableHeaderClassName}>
          <select value={selectedTable} onChange={this.onTableSelectionChange}>
            {resultSetOptions}
          </select>
          {numberOfResults}
          {selectedTable === ALERTS_TABLE_NAME
            ? this.alertTableExtras()
            : undefined}
          {this.props.isLoadingNewResults ? (
            <span className={UPDATING_RESULTS_TEXT_CLASS_NAME}>
              Updating results…
            </span>
          ) : null}
        </div>
        {resultSet && (
          <ResultTable
            key={resultSet.schema.name}
            resultSet={resultSet}
            databaseUri={this.props.database.databaseUri}
            resultsPath={this.props.resultsPath}
            sortState={this.props.sortStates.get(resultSet.schema.name)}
            nonemptyRawResults={nonemptyRawResults}
            showRawResults={() => {
              this.setState({ selectedTable: SELECT_TABLE_NAME });
              sendTelemetry("local-results-show-raw-results");
            }}
            offset={this.getOffset()}
          />
        )}
      </div>
    );
  }
}

function getDefaultResultSet(resultSets: readonly ResultSet[]): string {
  return getDefaultResultSetName(
    resultSets.map((resultSet) => resultSet.schema.name),
  );
}
