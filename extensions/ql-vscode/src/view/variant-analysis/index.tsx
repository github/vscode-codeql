import * as React from 'react';
import { WebviewDefinition } from '../webview-interface';
import { VariantAnalysis } from './VariantAnalysis';

const definition: WebviewDefinition = {
  component: <VariantAnalysis />,

  // This is temporarily using the wrong message type.
  // We will change it in the near future. 
  loadedMessage: 'remoteQueryLoaded'
};

export default definition;
