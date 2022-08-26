import * as React from 'react';
import { WebviewDefinition } from '../webview-interface';
import { RemoteQueries } from './RemoteQueries';

const definition: WebviewDefinition = {
  component: <RemoteQueries />,
  loadedMessage: 'remoteQueryLoaded'
};

export default definition;
