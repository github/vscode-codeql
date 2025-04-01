import type { ReactNode } from "react";
import { Alert } from "../common";
import { vscode } from "../vscode-api";
import { VariantAnalysisFailureReason } from "../../variant-analysis/shared/variant-analysis";
import { Link } from "../common/Link";

type Props = {
  failureReason: VariantAnalysisFailureReason;
};

const openLogs = () => {
  vscode.postMessage({
    t: "openLogs",
  });
};

const getTitle = (failureReason: VariantAnalysisFailureReason): string => {
  switch (failureReason) {
    case VariantAnalysisFailureReason.NoReposQueried:
      return "No repositories to analyze";
    case VariantAnalysisFailureReason.ActionsWorkflowRunFailed:
      return "GitHub Actions workflow run failed";
    case VariantAnalysisFailureReason.InternalError:
      return "Something unexpected happened";
  }
};

const getMessage = (failureReason: VariantAnalysisFailureReason): ReactNode => {
  switch (failureReason) {
    case VariantAnalysisFailureReason.NoReposQueried:
      return "No repositories available after processing. No repositories were analyzed.";
    case VariantAnalysisFailureReason.ActionsWorkflowRunFailed:
      return (
        <>
          The GitHub Actions workflow run has failed.{" "}
          <Link onClick={openLogs}>View actions logs</Link> and try running this
          query again.
        </>
      );
    case VariantAnalysisFailureReason.InternalError:
      return "An internal error occurred while running this variant analysis. Please try again later.";
  }
};

export const FailureReasonAlert = ({ failureReason }: Props) => {
  return (
    <Alert
      type="error"
      title={getTitle(failureReason)}
      message={getMessage(failureReason)}
    />
  );
};
