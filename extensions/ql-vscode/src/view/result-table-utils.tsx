import * as React from 'react';
import { LocationValue, ResolvableLocationValue, tryGetResolvableLocation } from 'semmle-bqrs';
import { SortState } from '../interface-types';
import { ResultSet, vscode } from './results';

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
  loc: ResolvableLocationValue,
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
  databaseUri: string, title?: string): JSX.Element {

  // If the label was empty, use a placeholder instead, so the link is still clickable.
  let displayLabel = label;
  if (label === undefined || label === '')
    displayLabel = '[empty string]';
  else if (label.match(/^\s+$/))
    displayLabel = `[whitespace: "${label}"]`;

  if (loc !== undefined) {
    const resolvableLoc = tryGetResolvableLocation(loc);
    if (resolvableLoc !== undefined) {
      return <a href="#"
        className="vscode-codeql__result-table-location-link"
        title={title}
        onClick={jumpToLocationHandler(resolvableLoc, databaseUri)}>{displayLabel}</a>;
    } else {
      return <span title={title}>{displayLabel}</span>;
    }
  }
  return <span />
}

/**
 * Returns the attributes for a zebra-striped table row at position `index`.
 */
export function zebraStripe(index: number, ...otherClasses: string[]): { className: string } {
  return { className: [(index % 2) ? oddRowClassName : evenRowClassName, otherClasses].join(' ') };
}
