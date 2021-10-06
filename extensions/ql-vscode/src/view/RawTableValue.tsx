import * as React from 'react';

import { renderLocation } from './result-table-utils';
import { ColumnValue } from '../pure/bqrs-cli-types';

interface Props {
  value: ColumnValue;
  databaseUri: string;
}

export default function RawTableValue(props: Props): JSX.Element {
  const v = props.value;
  const codes: { [key: string]: any } = {
    '\n': 'U+000A',
    '\b': 'U+2084',
    '\0': 'U+0000'
  };

  if (
    typeof v === 'string'
    || typeof v === 'number'
    || typeof v === 'boolean'
  ) {
    const text = v.toString();
    const newVal = text.split('');
    for (let i = 0; i < newVal.length; i++) {
      for (const char in codes) {
        if (char === newVal[i]) {
          newVal[i] = codes[char];
        }
      }
    }
    const cleanVal = newVal.join('');
    return <span>{cleanVal}</span>;
  }

  return renderLocation(v.url, v.label, props.databaseUri);
}
