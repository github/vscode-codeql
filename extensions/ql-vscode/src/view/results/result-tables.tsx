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
} from "../../pure/interface-types";
import { PathTable } from "./alert-table";
import { Graph } from "./graph";
import { RawTable } from "./raw-results-table";
import {
  ResultTableProps,
  tableHeaderClassName,
  tableHeaderItemClassName,
  toggleDiagnosticsClassName,
  alertExtrasClassName,
  openFile,
} from "./result-table-utils";
import { vscode } from "../vscode-api";
import { sendTelemetry } from "../common/telemetry";

const FILE_PATH_REGEX = /^(?:.+[\\/])*(.+)$/;

/**
 * Properties for the `ResultTables` component.
 */
export interface ResultTablesProps {
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
  selectedPage: string; // stringified selected page
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
    const selectedPage = `${props.parsedResultSets.pageNumber + 1}`;
    this.state = {
      selectedTable,
      selectedPage,
      problemsViewSelected: false,
    };
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

        return {
          selectedTable,
          selectedPage: `${props.parsedResultSets.pageNumber + 1}`,
        };
      });
    }
  }

  untoggleProblemsView() {
    this.setState({
      problemsViewSelected: false,
    });
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

  sendResultsPageChangedTelemetry() {
    sendTelemetry("local-results-alert-table-page-changed");
  }

  renderPageButtons(): JSX.Element {
    const { parsedResultSets } = this.props;
    const selectedTable = this.state.selectedTable;

    // FIXME: The extension, not the view, should be in charge of deciding whether to initially show
    // a raw or alerts page. We have to conditionally recompute the number of pages here, because
    // on initial load of query results, resultSets.numPages will have the number of *raw* pages available,
    // not interpreted pages, because the extension doesn't know the view will default to showing alerts
    // instead.
    const numPages = Math.max(
      selectedTable === ALERTS_TABLE_NAME
        ? parsedResultSets.numInterpretedPages
        : parsedResultSets.numPages,
      1,
    );

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      this.setState({ selectedPage: e.target.value });
      this.sendResultsPageChangedTelemetry();
    };
    const choosePage = (input: string) => {
      const pageNumber = parseInt(input);
      if (pageNumber !== undefined && !isNaN(pageNumber)) {
        const actualPageNumber = Math.max(
          0,
          Math.min(pageNumber - 1, numPages - 1),
        );
        vscode.postMessage({
          t: "changePage",
          pageNumber: actualPageNumber,
          selectedTable,
        });
      }
    };

    const prevPage = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      vscode.postMessage({
        t: "changePage",
        pageNumber: Math.max(parsedResultSets.pageNumber - 1, 0),
        selectedTable,
      });
      this.sendResultsPageChangedTelemetry();
    };
    const nextPage = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      vscode.postMessage({
        t: "changePage",
        pageNumber: Math.min(parsedResultSets.pageNumber + 1, numPages - 1),
        selectedTable,
      });
      this.sendResultsPageChangedTelemetry();
    };

    const openQuery = () => {
      openFile(this.props.queryPath);
      sendTelemetry("local-results-open-query-file");
    };
    const fileName = FILE_PATH_REGEX.exec(this.props.queryPath)?.[1] || "query";

    return (
      <span className="vscode-codeql__table-selection-pagination">
        <button onClick={prevPage}>&#xab;</button>
        <input
          type="number"
          size={3}
          value={this.state.selectedPage}
          min="1"
          max={numPages}
          onChange={onChange}
          onBlur={(e) => choosePage(e.target.value)}
          onKeyDown={(e) => {
            if (e.keyCode === 13) {
              choosePage((e.target as HTMLInputElement).value);
            }
          }}
        />
        <span>/&nbsp;{numPages}</span>
        <button value=">" onClick={nextPage}>
          &#xbb;
        </button>
        <div className={tableHeaderItemClassName}>{this.props.queryName}</div>
        <div className={tableHeaderItemClassName}>
          <a
            href="#"
            onClick={openQuery}
            className="vscode-codeql__result-table-location-link"
          >
            Open {fileName}
          </a>
        </div>
      </span>
    );
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
        {this.renderPageButtons()}
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

  private vscodeMessageHandler(evt: MessageEvent) {
    // sanitize origin
    const origin = evt.origin.replace(/\n|\r/g, "");
    evt.origin === window.origin
      ? this.handleMessage(evt.data as IntoResultsViewMsg)
      : console.error(`Invalid event origin ${origin}`);
  }
}

class ResultTable extends React.Component<
  ResultTableProps,
  Record<string, never>
> {
  constructor(props: ResultTableProps) {
    super(props);
  }

  render(): React.ReactNode {
    const { resultSet } = this.props;
    switch (resultSet.t) {
      case "RawResultSet":
        return <RawTable {...this.props} resultSet={resultSet} />;
      case "InterpretedResultSet": {
        const data = resultSet.interpretation.data;
        switch (data.t) {
          case "SarifInterpretationData": {
            const sarifResultSet = {
              ...resultSet,
              interpretation: { ...resultSet.interpretation, data },
            };
            return <PathTable {...this.props} resultSet={sarifResultSet} />;
          }
          case "GraphInterpretationData": {
            const grapResultSet = {
              ...resultSet,
              interpretation: { ...resultSet.interpretation, data },
            };
            return <Graph {...this.props} resultSet={grapResultSet} />;
          }
        }
      }
    }
  }
}

function getDefaultResultSet(resultSets: readonly ResultSet[]): string {
  return getDefaultResultSetName(
    resultSets.map((resultSet) => resultSet.schema.name),
  );
}
