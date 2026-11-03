import type { ReactNode } from "react";
import { Alert } from "../common";
import { vscode } from "../vscode-api";
import { VariantAnalysisFailureReason } from "../../variant-analysis/shared/variant-analysis";
import { Link } from "../common/Link";

type Props = {
  failureReason: VariantAnalysisFailureReason;
  serverUrl?: string;
  canViewLogs?: boolean;
};

const openLogs = () => {
  vscode.postMessage({
    t: "openLogs",
  });
};

const getTitle = (
  failureReason: VariantAnalysisFailureReason,
  serverUrl?: string,
): string => {
  switch (failureReason) {
    case VariantAnalysisFailureReason.NoReposQueried:
      return "No repositories to analyze";
    case VariantAnalysisFailureReason.ActionsWorkflowRunFailed:
      return serverUrl
        ? "Variant analysis failed"
        : "GitHub Actions workflow run failed";
    case VariantAnalysisFailureReason.InternalError:
      return "Something unexpected happened";
  }
};

const getMessage = (
  failureReason: VariantAnalysisFailureReason,
  serverUrl?: string,
  canViewLogs?: boolean,
): ReactNode => {
  switch (failureReason) {
    case VariantAnalysisFailureReason.NoReposQueried:
      return "No repositories available after processing. No repositories were analyzed.";
    case VariantAnalysisFailureReason.ActionsWorkflowRunFailed:
      return (
        <>
          {serverUrl
            ? "The variant analysis run has failed."
            : "The GitHub Actions workflow run has failed."}{" "}
          {(canViewLogs ?? !serverUrl) && (
            <>
              <Link onClick={openLogs}>
                {serverUrl ? "View logs" : "View actions logs"}
              </Link>{" "}
              and{" "}
            </>
          )}
          try running this query again.
        </>
      );
    case VariantAnalysisFailureReason.InternalError:
      return "An internal error occurred while running this variant analysis. Please try again later.";
  }
};

export const FailureReasonAlert = ({
  failureReason,
  serverUrl,
  canViewLogs,
}: Props) => {
  return (
    <Alert
      type="error"
      title={getTitle(failureReason, serverUrl)}
      message={getMessage(failureReason, serverUrl, canViewLogs)}
    />
  );
};
