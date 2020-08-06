import * as React from 'react';

import { renderLocation } from './result-table-utils';
import { ColumnValue } from '../bqrs-cli-types';
import { isStringLoc, isWholeFileLoc, isLineColumnLoc } from '../bqrs-utils';

interface Props {
  value: ColumnValue;
  databaseUri: string;
}

export default function RawTableValue(props: Props): JSX.Element {
  const v = props.value;
  if (typeof v === 'string'
    || typeof v === 'number'
    || typeof v === 'boolean') {
    return <span>{v}</span>;
  }

  const loc = v.url;
  if (!loc) {
    return <span />;
  } else if (isStringLoc(loc)) {
    return <a href={loc}>{loc}</a>;
  } else if (isWholeFileLoc(loc) || isLineColumnLoc(loc)) {
    return renderLocation(loc, v.label, props.databaseUri);
  } else {
    return <span />;
  }
}
