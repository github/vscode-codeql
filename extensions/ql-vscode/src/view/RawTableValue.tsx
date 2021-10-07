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
  '\v': 'U+000B',
  '\r': 'U+000D'
};

function onlyNewLine(element: string, index: number, array: string[]) {
  return element === '\n';
}

export default function RawTableValue(props: Props): JSX.Element {
  const rawValue = props.value;

  if (
    typeof rawValue === 'string'
    || typeof rawValue === 'number'
    || typeof rawValue === 'boolean'
  ) {
    const text = rawValue.toString();
    const newVal = text.split('').filter((element: string) => element !== ' ');
    if (newVal.every(onlyNewLine)) {
      const cleanVal = '[' + newVal.join('') + ']';
      return <span>{cleanVal}</span>;
    } else {
      for (let i = 0; i < newVal.length; i++) {
        newVal[i] = codes[newVal[i]] || newVal[i];
      }
      const cleanVal = newVal.join('');
      return <span>{cleanVal}</span>;
    }
  }

  return renderLocation(rawValue.url, rawValue.label, props.databaseUri);
}
