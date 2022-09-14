import * as React from 'react';
import { WebviewDefinition } from '../webview-interface';
import { ResultsApp } from './results';

const definition: WebviewDefinition = {
  component: <ResultsApp />
};

export default definition;
