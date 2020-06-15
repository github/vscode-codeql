import * as React from 'react';

import { ResultValue } from '../adapt';
import { renderLocation } from './result-table-utils';

interface Props {
  value: ResultValue;
  databaseUri: string;
}

export default function RawTableValue(props: Props): JSX.Element {
  const v = props.value;
  if (typeof v === 'string') {
    return <span>{v}</span>;
  }
  else if ('uri' in v) {
    return <a href={v.uri}>{v.uri}</a>;
  }
  else {
    return renderLocation(v.location, v.label, props.databaseUri);
  }
}
