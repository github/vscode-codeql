import * as React from 'react';

import { renderLocation } from './result-table-utils';
import { ColumnValue } from '../pure/bqrs-cli-types';

interface Props {
  value: ColumnValue;
  databaseUri: string;
}

const codes: { [key: string]: any } = {
  '\0': 'U+0000',
  '\b': 'U+0008',
  '\t': 'U+0009',
  '\n': 'U+000A',
  '\v': 'U+000B',
  '\r': 'U+000D'
};

export default function RawTableValue(props: Props): JSX.Element {
  const rawValue = props.value;

  if (
    typeof rawValue === 'string'
    || typeof rawValue === 'number'
    || typeof rawValue === 'boolean'
  ) {
    const text = rawValue.toString();
    const newVal = text.split('');
    for (let i = 0; i < newVal.length; i++) {
      newVal[i] = codes[newVal[i]] || newVal[i];
    }
    const cleanVal = newVal.join('');
    return <span>{cleanVal}</span>;
  }

  return renderLocation(rawValue.url, rawValue.label, props.databaseUri);
}
