import * as React from 'react';
import { isResolvableLocation, LocationStyle, LocationValue } from 'semmle-bqrs';
import { ResultSet, vscode } from './results';



export interface ResultTableProps {
  selected: boolean;
  resultSet: ResultSet;
  databaseUri: string;
  resultsPath: string | undefined;
}

export const className = 'vscode-codeql__result-table';
export const tableMetadataClassName = `${className}-metadata`;
export const selectedClassName = `${className}--selected`;
export const evenRowClassName = 'vscode-codeql__result-table-row--even';
export const oddRowClassName = 'vscode-codeql__result-table-row--odd';
export const pathRowClassName = 'vscode-codeql__result-table-row--path';

/**
 * Render a location as a link which when clicked displays the original location.
 */
export function renderLocation(loc: LocationValue | undefined, label: string | undefined,
  databaseUri: string): JSX.Element {

  if (loc !== undefined) {
    switch (loc.t) {
      case LocationStyle.FivePart: {
        if (isResolvableLocation(loc)) {
          return <a href="#" className="vscode-codeql__result-table-location-link" onClick={(e) => {
            vscode.postMessage({
              t: 'viewSourceFile',
              loc,
              databaseUri
            });
            e.preventDefault();
            e.stopPropagation();
          }}>{label}</a>;
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
