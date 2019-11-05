import * as React from 'react';
import { isResolvableLocation, LocationStyle, LocationValue, FivePartLocation } from 'semmle-bqrs';
import { ResultSet, vscode } from './results';
import { SortState } from '../interface-types';

export interface ResultTableProps {
  selected: boolean;
  resultSet: ResultSet;
  databaseUri: string;
  resultsPath: string | undefined;
  sortState?: SortState;
}

export const className = 'vscode-codeql__result-table';
export const tableSelectionHeaderClassName = 'vscode-codeql__table-selection-header';
export const toggleDiagnosticsClassName = `${className}-toggle-diagnostics`;
export const selectedClassName = `${className}--selected`;
export const toggleDiagnosticsSelectedClassName = `${toggleDiagnosticsClassName}--selected`;
export const evenRowClassName = 'vscode-codeql__result-table-row--even';
export const oddRowClassName = 'vscode-codeql__result-table-row--odd';
export const pathRowClassName = 'vscode-codeql__result-table-row--path';

export function jumpToLocationHandler(
  loc: FivePartLocation,
  databaseUri: string
): (e: React.MouseEvent) => void {
  return (e) => {
    vscode.postMessage({
      t: 'viewSourceFile',
      loc,
      databaseUri
    });
    e.preventDefault();
    e.stopPropagation();
  };
}

/**
 * Render a location as a link which when clicked displays the original location.
 */
export function renderLocation(loc: LocationValue | undefined, label: string | undefined,
  databaseUri: string): JSX.Element {

  if (loc !== undefined) {
    switch (loc.t) {
      case LocationStyle.FivePart: {
        if (isResolvableLocation(loc)) {
          return <a href="#"
            className="vscode-codeql__result-table-location-link"
            onClick={jumpToLocationHandler(loc, databaseUri)}>{label}</a>;
        }
        else {
          return <span>{label}</span>;
        }
      }
      case LocationStyle.String: return <span>{label}</span>;
    }
  }

  return <span />
}
