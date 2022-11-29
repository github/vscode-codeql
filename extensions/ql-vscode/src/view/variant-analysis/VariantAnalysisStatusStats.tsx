import * as React from "react";
import styled from "styled-components";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";
import { formatDate } from "../../pure/date";
import { VariantAnalysisStatus } from "../../remote-queries/shared/variant-analysis";

type Props = {
  variantAnalysisStatus: VariantAnalysisStatus;
  completedAt?: Date;

  onViewLogsClick?: () => void;
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5em;
`;

const Icon = styled.span`
  font-size: 1em !important;
  vertical-align: text-bottom;
`;

export const VariantAnalysisStatusStats = ({
  variantAnalysisStatus,
  completedAt,
  onViewLogsClick,
}: Props) => {
  if (variantAnalysisStatus === VariantAnalysisStatus.InProgress) {
    return <Icon className="codicon codicon-loading codicon-modifier-spin" />;
  }

  return (
    <Container>
      <span>{completedAt !== undefined ? formatDate(completedAt) : "-"}</span>
      {onViewLogsClick && (
        <VSCodeLink onClick={onViewLogsClick}>View logs</VSCodeLink>
      )}
    </Container>
  );
};
