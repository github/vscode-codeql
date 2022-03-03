import * as React from 'react';
import { AnalysisAlert } from '../shared/analysis-result';
import FileCodeSnippet from './FileCodeSnippet';

const AnalysisAlertResult = ({ alert }: { alert: AnalysisAlert }) => {

  return <FileCodeSnippet
    filePath={alert.filePath}
    codeSnippet={alert.codeSnippet}
    highlightedRegion={alert.highlightedRegion}
    severity={alert.severity}
    message={alert.message}
  />;
};

export default AnalysisAlertResult;
