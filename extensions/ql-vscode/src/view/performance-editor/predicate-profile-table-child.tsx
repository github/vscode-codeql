import * as React from "react";
import { vscode } from "../vscode-api";
import { Position } from "../../../src/performance-editor/performance-editor-log-reader";

import {
  VSCodeDataGrid,
  VSCodeDataGridRow,
  VSCodeDataGridCell,
} from "@vscode/webview-ui-toolkit/react";

import {
  PerformanceEditorDetail,
  PerformanceEditorRow,
} from "../../../src/performance-editor/performance-editor-model";

import "./predicateProfileTable.css";

export interface PredicateProfileTableChildProps {
  row: PerformanceEditorRow;
  amortize: boolean;
}

export interface PredicateProfileTableChildData {
  predicate: string;
  selfTime: number;
  aggregateTime: number;
  percentOfTotalSelf: number;
  percentOfTotalSelfAndAggregate: number;
  file: string;
  position: Position;
  depth: number;
}

export interface PredicateProfileTableChildState {
  depth?: number;
}

export class PredicateProfileTableChild extends React.Component<
  PredicateProfileTableChildProps,
  PredicateProfileTableChildState
> {
  constructor(props: any) {
    super(props);

    this.state = {};
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

  getNormalizedDepthMap(rows: PerformanceEditorDetail[]): Map<number, number> {
    const depths = new Set<number>();
    rows.forEach((row) => {
      depths.add(row.depth);
    });

    const uniqueDepths = Array.from(depths.keys()).sort((a, b) => a - b);

    const depthMap = new Map<number, number>();

    uniqueDepths.forEach((depth, index) => {
      depthMap.set(depth, index);
    });

    return depthMap;
  }

  render(): JSX.Element {
    const depthMap = this.getNormalizedDepthMap(
      this.props.row.dependencies || [],
    );
    // now, map it to the row data structure
    let rowData: PredicateProfileTableChildData[] =
      this.props.row.dependencies?.map((row, index) => {
        return {
          predicate: row.detail.predicateName,
          selfTime: this.props.amortize
            ? row.detail.selfTimeAmortized
            : row.detail.selfTime,
          aggregateTime: this.props.amortize
            ? row.detail.aggregateTimeAmortized
            : row.detail.aggregateTime,
          percentOfTotalSelf: this.props.amortize
            ? row.detail.percentOfTotalSelfAmortized
            : row.detail.percentOfTotalSelf,
          percentOfTotalSelfAndAggregate: this.props.amortize
            ? row.detail.percentOfTotalAggregateAmortized
            : row.detail.percentOfTotalAggregate,
          file: row.detail.position.url,
          depth: depthMap.get(row.depth) || 0,
          position: row.detail.position,
        };
      }) || [];

    // sort the data by level
    rowData = rowData.sort((a, b) => a.depth - b.depth);

    return (
      <VSCodeDataGrid
        selection-mode="none"
        gridTemplateColumns="1fr 1fr 1fr 1fr 4fr 3fr"
      >
        <VSCodeDataGridRow row-type="sticky-header">
          <VSCodeDataGridCell cell-type="columnheader" grid-column="1">
            {this.props.amortize ? "Self Time (Amortized)" : "Self Time"}
          </VSCodeDataGridCell>
          <VSCodeDataGridCell cell-type="columnheader" grid-column="2">
            {this.props.amortize ? "Total Time (Amortized)" : "Total Time"}
          </VSCodeDataGridCell>
          <VSCodeDataGridCell cell-type="columnheader" grid-column="3">
            % Self
          </VSCodeDataGridCell>
          <VSCodeDataGridCell cell-type="columnheader" grid-column="4">
            % Total
          </VSCodeDataGridCell>

          <VSCodeDataGridCell cell-type="columnheader" grid-column="5">
            Predicate
          </VSCodeDataGridCell>

          <VSCodeDataGridCell cell-type="columnheader" grid-column="6">
            File
          </VSCodeDataGridCell>
        </VSCodeDataGridRow>

        {rowData.map((row) => (
          <VSCodeDataGridRow className="rows row" key={row.predicate}>
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
            <VSCodeDataGridCell
              grid-column="5"
              className="fixedWidth"
              style={{ paddingLeft: `calc(10px*${row.depth})` }}
            >
              <div className="codicon codicon-chevron-down"></div>
              <div className="predicate">{row.predicate}</div>
            </VSCodeDataGridCell>
            <VSCodeDataGridCell
              grid-column="6"
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
