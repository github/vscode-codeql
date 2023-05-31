import * as React from "react";
import { Allotment } from "allotment";

//import { assertNever, getErrorMessage } from "../../pure/helpers-pure";
import { IntoPerformanceEditorViewMsg } from "../../pure/interface-types";

//import { EventHandlers as EventHandlerList } from "./event-handler-list";

// import { FilterBar } from "./filter-bar";

import "./performanceEditor.css";
import { FilterBar, FilterBarState } from "./filter-bar";
import { PredicateProfileTable } from "./predicate-profile-table";
import { PerformanceEditorRow } from "../../performance-editor/performance-editor-model";
import { PredicateProfileTableChild } from "./predicate-profile-table-child";

interface PerformanceEditorViewState {
  show: boolean;
  performanceEditorRows: PerformanceEditorRow[];
  filterString: string;
  selectedParentRow?: PerformanceEditorRow;
  amortize: boolean;
}

export class PerformanceEditorViewApp extends React.Component<
  Record<string, never>,
  PerformanceEditorViewState
> {
  constructor(props: any) {
    super(props);

    this.state = {
      show: false,
      performanceEditorRows: [],
      filterString: "",
      amortize: false,
    };

    // this.state = {
    //   displayedResults: {
    //     resultsInfo: null,
    //     results: null,
    //     errorMessage: "",
    //   },
    //   nextResultsInfo: null,
    //   isExpectingResultsUpdate: true,
    //   show: false,
    // };

    this.updateFilter = this.updateFilter.bind(this);
    this.parentRowSelected = this.parentRowSelected.bind(this);
    this.onToggleAmortizeCostAcrossQueries =
      this.onToggleAmortizeCostAcrossQueries.bind(this);
  }

  handleMessage(msg: IntoPerformanceEditorViewMsg): void {
    console.log("handing message for performance view!");
    switch (msg.t) {
      case "setState":
        this.setState({
          show: false,
          performanceEditorRows: msg.performanceEditorRows,
        });

        break;
      //   case "resultsUpdating":
      //     // this.setState({
      //     //   isExpectingResultsUpdate: true,
      //     // });
      //     break;
      default:
        //assertNever(msg);
        break;
    }
  }

  updateFilter(filter: string, state: FilterBarState) {
    this.setState({
      filterString: filter,
    });
  }

  //   private updateStateWithNewResultsInfo(resultsInfo: ResultsInfo): void {
  //     this.setState((prevState) => {
  //       if (resultsInfo === null && prevState.isExpectingResultsUpdate) {
  //         // Display loading message
  //         return {
  //           displayedResults: {
  //             resultsInfo: null,
  //             results: null,
  //             errorMessage: "Loading results…",
  //           },
  //           isExpectingResultsUpdate: prevState.isExpectingResultsUpdate,
  //           nextResultsInfo: resultsInfo,
  //         };
  //       } else if (resultsInfo === null) {
  //         // No results to display
  //         return {
  //           displayedResults: {
  //             resultsInfo: null,
  //             results: null,
  //             errorMessage: "No results to display",
  //           },
  //           isExpectingResultsUpdate: prevState.isExpectingResultsUpdate,
  //           nextResultsInfo: resultsInfo,
  //         };
  //       }

  //       let results: Results | null = null;
  //       let statusText = "";
  //       try {
  //         const resultSets = this.getResultSets(resultsInfo);
  //         results = {
  //           resultSets,
  //           database: resultsInfo.database,
  //           sortStates: this.getSortStates(resultsInfo),
  //         };
  //       } catch (e) {
  //         const errorMessage = getErrorMessage(e);

  //         statusText = `Error loading results: ${errorMessage}`;
  //       }

  //       return {
  //         displayedResults: {
  //           resultsInfo,
  //           results,
  //           errorMessage: statusText,
  //         },
  //         nextResultsInfo: null,
  //         isExpectingResultsUpdate: false,
  //       };
  //     });
  //   }

  parentRowSelected(row: PerformanceEditorRow) {
    this.setState({
      selectedParentRow: row,
    });
  }

  onToggleAmortizeCostAcrossQueries(amortize: boolean) {
    this.setState({
      amortize,
    });
  }

  render() {
    return (
      <div style={{ height: "calc(100vh)", width: "100%" }}>
        <FilterBar
          onFilterChange={this.updateFilter}
          onToggleAmortizeCostAcrossQueries={
            this.onToggleAmortizeCostAcrossQueries
          }
        />

        {this.state.show ? (
          <div>What happens if I put content in the middle?</div>
        ) : null}
        <Allotment defaultSizes={[100, 200]} vertical={true}>
          <div
            style={{
              height: "calc(100vh)",
              width: "100%",
              overflow: "auto",
            }}
          >
            <PredicateProfileTable
              rows={this.state.performanceEditorRows}
              filterString={this.state.filterString}
              rowSelectedCallback={this.parentRowSelected}
              amortize={this.state.amortize}
            />
          </div>
          <div>
            {this.state.selectedParentRow ? (
              <div
                style={{
                  height: "calc(100vh)",
                  width: "100%",
                  overflow: "auto",
                }}
              >
                <PredicateProfileTableChild
                  row={this.state.selectedParentRow}
                  amortize={this.state.amortize}
                />
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  overflow: "auto",
                  marginTop: "calc(20vh)",
                }}
              >
                Select a predicate to view its dependencies
              </div>
            )}
          </div>
        </Allotment>
      </div>
    );
  }

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
      ? this.handleMessage(evt.data as IntoPerformanceEditorViewMsg)
      : console.error(`Invalid event origin ${origin}`);
  }
}
