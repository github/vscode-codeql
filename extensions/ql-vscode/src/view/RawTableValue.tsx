import * as React from 'react';

import { renderLocation } from './result-table-utils';
import { ColumnValue } from '../pure/bqrs-cli-types';

interface Props {
  value: ColumnValue;
  databaseUri: string;
}

export default function RawTableValue(props: Props): JSX.Element {
  const v = props.value;
  const codes: { [key: string]: any } = { '\n': 'U+000A', '\b': 'U+2408', '\0': 'U+0000' };
  if (
    typeof v === 'string'
    || typeof v === 'number'
    || typeof v === 'boolean'
  ) {
    const text = v.toString();
    const newV = text.split('');
    for (let i = 0; i < newV.length; i++) {
      for (const code in codes) {
        if (code === newV[i]) {
          newV[i] = codes[code];
        }
      }
    }
    const filtered = newV.join('');
    return <span>{filtered}</span>;
  }

  return renderLocation(v.url, v.label, props.databaseUri);
}
