import * as React from 'react';
import { AnalysisAlert } from '../shared/analysis-result';
import CodePaths from './CodePaths';
import FileCodeSnippet from './FileCodeSnippet';

const AnalysisAlertResult = ({ alert }: { alert: AnalysisAlert }) => {
  const showPathsLink = alert.codeFlows.length > 0;

  return <FileCodeSnippet
    fileLink={alert.fileLink}
    codeSnippet={alert.codeSnippet}
    highlightedRegion={alert.highlightedRegion}
    severity={alert.severity}
    message={alert.message}
    messageChildren={
      showPathsLink && <CodePaths
        codeFlows={alert.codeFlows}
        ruleDescription={alert.shortDescription}
        severity={alert.severity}
        message={alert.message}
      />
    }
  />;
};

export default AnalysisAlertResult;
