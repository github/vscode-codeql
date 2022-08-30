import * as React from 'react';
import { WebviewDefinition } from '../webview-interface';
import { ResultsApp } from './results';

const definition: WebviewDefinition = {
  component: <ResultsApp />,
  loadedMessage: 'resultViewLoaded'
};

export default definition;
