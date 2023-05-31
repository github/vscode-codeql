import * as React from "react";

import {
  VSCodeDataGrid,
  VSCodeDataGridRow,
  VSCodeDataGridCell,
} from "@vscode/webview-ui-toolkit/react";
import { PerformanceEditorRow } from "../../../src/performance-editor/performance-editor-model";
import { Position } from "../../../src/performance-editor/performance-editor-log-reader";
import "./predicateProfileTable.css";
import { vscode } from "../vscode-api";

export interface PredicateProfileTableProps {
  rows: PerformanceEditorRow[];
  filterString: string;
  rowSelectedCallback: (row: PerformanceEditorRow) => void;
  amortize: boolean;
}

export interface PredicateProfileTableData {
  predicate: string;
  selfTime: number;
  aggregateTime: number;
  percentOfTotalSelf: number;
  percentOfTotalSelfAndAggregate: number;
  file: string;
  position: Position;
  idx: number;
  uses: number;
}

type PredicateProfileTableSortColumn =
  | "selfTime"
  | "aggregateTime"
  | "predicate"
  | "file"
  | "percentOfTotalSelf"
  | "percentOfTotalSelfAndAggregate"
  | "children"
  | "uses";

type PredicateProfileTableSortDirection = "asc" | "desc";

export interface PredicateProfileTableState {
  sortColumn: PredicateProfileTableSortColumn;
  sortDirection: PredicateProfileTableSortDirection;
}

export class PredicateProfileTable extends React.Component<
  PredicateProfileTableProps,
  PredicateProfileTableState
> {
  constructor(props: any) {
    super(props);

    this.state = {
      sortColumn: "selfTime",
      sortDirection: "desc",
    };

    this.changeSort = this.changeSort.bind(this);

    // set up the initial data
  }

  selectRow(index: number) {
    this.props.rowSelectedCallback(this.props.rows[index]);
  }

  changeSort(sortColumn: PredicateProfileTableSortColumn) {
    let sortDirection: PredicateProfileTableSortDirection = "asc";

    // toggle the sort direction if we're already sorting by this column
    if (this.state.sortColumn === sortColumn) {
      if (this.state.sortDirection === "asc") {
        sortDirection = "desc";
      } else {
        sortDirection = "asc";
      }
    }

    this.setState({
      sortColumn,
      sortDirection,
    });
  }

  childrenForIndex(index: number): number {
    const len = this.props.rows[index].dependencies?.length;
    if (len !== undefined) {
      return len - 1;
    }
    return 0;
  }

  openFile(position: Position) {
    vscode.postMessage({
      t: "jumpToPredicate",
      location: {
        uri: position.url,
        startLine: position.startLine,
        startColumn: position.startColumn,
        endLine: position.endLine,
        endColumn: position.endColumn,
      },
    });
  }

  render(): JSX.Element {
    // now, map it to the row data structure
    let rowData: PredicateProfileTableData[] = this.props.rows.map(
      (row, index) => {
        return {
          predicate: row.predicateName,
          selfTime: this.props.amortize ? row.selfTimeAmortized : row.selfTime,
          aggregateTime: this.props.amortize
            ? row.aggregateTimeAmortized
            : row.aggregateTime,
          percentOfTotalSelf: this.props.amortize
            ? row.percentOfTotalSelfAmortized
            : row.percentOfTotalSelf,
          percentOfTotalSelfAndAggregate: this.props.amortize
            ? row.percentOfTotalAggregateAmortized
            : row.percentOfTotalAggregate,
          file: row.position.url,
          position: row.position,
          idx: index,
          uses: row.uses,
        };
      },
    );

    // filter the data
    if (this.props.filterString !== "") {
      rowData = rowData.filter((row) => {
        return (
          row.predicate
            .toLowerCase()
            .indexOf(this.props.filterString.toLowerCase()) > -1
        );
      });
    }

    // sort the data
    rowData = rowData.sort((a, b) => {
      let l = a;
      let r = b;

      if (this.state.sortDirection === "desc") {
        l = b;
        r = a;
      }

      if (this.state.sortColumn === "predicate") {
        return l.predicate.localeCompare(r.predicate);
      } else if (this.state.sortColumn === "file") {
        return l.file.localeCompare(r.file);
      } else if (this.state.sortColumn === "selfTime") {
        return l.selfTime - r.selfTime;
      } else if (this.state.sortColumn === "aggregateTime") {
        return l.aggregateTime - r.aggregateTime;
      } else if (this.state.sortColumn === "percentOfTotalSelf") {
        return l.percentOfTotalSelf - r.percentOfTotalSelf;
      } else if (this.state.sortColumn === "children") {
        return this.childrenForIndex(l.idx) - this.childrenForIndex(r.idx);
      } else if (this.state.sortColumn === "uses") {
        return l.uses - r.uses;
      } else {
        return (
          l.percentOfTotalSelfAndAggregate - r.percentOfTotalSelfAndAggregate
        );
      }
    });

    return (
      <VSCodeDataGrid
        selection-mode="none"
        gridTemplateColumns="1fr 1fr 1fr 1fr 4fr 1fr 1fr 3fr"
      >
        <VSCodeDataGridRow row-type="sticky-header">
          <VSCodeDataGridCell
            cell-type="columnheader"
            grid-column="1"
            onClick={() => {
              this.changeSort("selfTime");
            }}
            className={
              this.state.sortColumn === "selfTime"
                ? "column-header activeSort"
                : "column-header"
            }
          >
            {this.props.amortize ? "Self Time (Amortized)" : "Self Time"}
          </VSCodeDataGridCell>
          <VSCodeDataGridCell
            cell-type="columnheader"
            grid-column="2"
            onClick={() => {
              this.changeSort("aggregateTime");
            }}
            className={
              this.state.sortColumn === "aggregateTime"
                ? "column-header activeSort"
                : "column-header"
            }
          >
            {this.props.amortize ? "Total Time (Amortized)" : "Total Time"}
          </VSCodeDataGridCell>
          <VSCodeDataGridCell
            cell-type="columnheader"
            grid-column="3"
            onClick={() => {
              this.changeSort("percentOfTotalSelf");
            }}
            className={
              this.state.sortColumn === "percentOfTotalSelf"
                ? "column-header activeSort"
                : "column-header"
            }
          >
            % Self (Overall)
          </VSCodeDataGridCell>
          <VSCodeDataGridCell
            cell-type="columnheader"
            grid-column="4"
            onClick={() => {
              this.changeSort("percentOfTotalSelfAndAggregate");
            }}
            className={
              this.state.sortColumn === "percentOfTotalSelfAndAggregate"
                ? "column-header activeSort"
                : "column-header"
            }
          >
            % Total (Overall)
          </VSCodeDataGridCell>

          <VSCodeDataGridCell
            cell-type="columnheader"
            grid-column="5"
            onClick={() => {
              this.changeSort("predicate");
            }}
            className={
              this.state.sortColumn === "predicate"
                ? "column-header activeSort"
                : "column-header"
            }
          >
            Predicate
          </VSCodeDataGridCell>

          <VSCodeDataGridCell
            cell-type="columnheader"
            grid-column="6"
            onClick={() => {
              this.changeSort("children");
            }}
            className={
              this.state.sortColumn === "children"
                ? "column-header activeSort"
                : "column-header"
            }
          >
            # Deps
          </VSCodeDataGridCell>

          <VSCodeDataGridCell
            cell-type="columnheader"
            grid-column="7"
            onClick={() => {
              this.changeSort("uses");
            }}
            className={
              this.state.sortColumn === "uses"
                ? "column-header activeSort"
                : "column-header"
            }
          >
            # Uses
          </VSCodeDataGridCell>

          <VSCodeDataGridCell
            cell-type="columnheader"
            grid-column="8"
            onClick={() => {
              this.changeSort("file");
            }}
            className={
              this.state.sortColumn === "file"
                ? "column-header activeSort"
                : "column-header"
            }
          >
            File
          </VSCodeDataGridCell>
        </VSCodeDataGridRow>

        {rowData.map((row) => (
          <VSCodeDataGridRow
            className="rows row"
            key={row.predicate}
            onClick={() => {
              this.selectRow(row.idx);
            }}
          >
            <VSCodeDataGridCell grid-column="1" className="fixedWidth duration">
              {Math.round(row.selfTime)}ms
            </VSCodeDataGridCell>
            <VSCodeDataGridCell grid-column="2" className="fixedWidth duration">
              {Math.round(row.aggregateTime)}ms
            </VSCodeDataGridCell>
            <VSCodeDataGridCell grid-column="3" className="fixedWidth">
              {Math.min(row.percentOfTotalSelf, 100).toFixed(2)}
            </VSCodeDataGridCell>
            <VSCodeDataGridCell grid-column="4" className="fixedWidth">
              {Math.min(row.percentOfTotalSelfAndAggregate, 100).toFixed(2)}
            </VSCodeDataGridCell>
            <VSCodeDataGridCell grid-column="5" className="fixedWidth">
              {row.predicate}
            </VSCodeDataGridCell>
            <VSCodeDataGridCell grid-column="6" className="fixedWidth">
              {this.childrenForIndex(row.idx)}
            </VSCodeDataGridCell>
            <VSCodeDataGridCell grid-column="7" className="fixedWidth">
              {row.uses}
            </VSCodeDataGridCell>
            <VSCodeDataGridCell
              grid-column="8"
              className="fixedWidth file"
              onClick={() => this.openFile(row.position)}
            >
              {row.file}
            </VSCodeDataGridCell>
          </VSCodeDataGridRow>
        ))}
      </VSCodeDataGrid>
    );
  }
}
