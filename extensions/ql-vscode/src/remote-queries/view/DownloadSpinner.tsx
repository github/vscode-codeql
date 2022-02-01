import { Spinner } from '@primer/react';
import * as React from 'react';

const DownloadSpinner = () => (
  <span className="vscode-codeql__download-spinner">
    <Spinner size="small" />
  </span>
);

export default DownloadSpinner;
