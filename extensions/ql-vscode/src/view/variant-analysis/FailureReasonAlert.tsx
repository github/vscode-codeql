import * as React from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { Alert } from '../common';
import { vscode } from '../vscode-api';
import { VariantAnalysisFailureReason } from '../../remote-queries/shared/variant-analysis';

type Props = {
  failureReason: VariantAnalysisFailureReason;
  showLogsButton: boolean;
};

const getTitle = (failureReason: VariantAnalysisFailureReason): string => {
  switch (failureReason) {
    case VariantAnalysisFailureReason.NoReposQueried:
      return 'No repositories to analyze';
    case VariantAnalysisFailureReason.InternalError:
      return 'Something unexpected happened';
  }
};

const getMessage = (failureReason: VariantAnalysisFailureReason): string => {
  switch (failureReason) {
    case VariantAnalysisFailureReason.NoReposQueried:
      return 'No repositories available after processing. No repositories were analyzed.';
    case VariantAnalysisFailureReason.InternalError:
      return 'An internal error occurred while running this variant analysis. Please try again later.';
  }
};

const openLogs = () => {
  vscode.postMessage({
    t: 'openLogs',
  });
};

export const FailureReasonAlert = ({
  failureReason,
  showLogsButton,
}: Props) => {
  return (
    <Alert
      type="error"
      title={getTitle(failureReason)}
      message={getMessage(failureReason)}
      actions={showLogsButton && <VSCodeButton appearance="secondary" onClick={openLogs}>View logs</VSCodeButton>}
    />
  );
};
