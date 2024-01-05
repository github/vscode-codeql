import type { AnalysisAlert } from "../../variant-analysis/shared/analysis-result";
import { CodePaths, FileCodeSnippet } from "../common";

const AnalysisAlertResult = ({ alert }: { alert: AnalysisAlert }) => {
  const showPathsLink = alert.codeFlows.length > 0;

  return (
    <FileCodeSnippet
      fileLink={alert.fileLink}
      codeSnippet={alert.codeSnippet}
      highlightedRegion={alert.highlightedRegion}
      severity={alert.severity}
      message={alert.message}
      messageChildren={
        showPathsLink && (
          <CodePaths
            codeFlows={alert.codeFlows}
            ruleDescription={alert.shortDescription}
            severity={alert.severity}
            message={alert.message}
          />
        )
      }
    />
  );
};

export default AnalysisAlertResult;
