import * as React from 'react';
import { WebviewDefinition } from '../webview-interface';
import { Compare } from './Compare';

const definition: WebviewDefinition = {
  component: <Compare />,
  loadedMessage: 'compareViewLoaded'
};

export default definition;
