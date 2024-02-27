import { styled } from "styled-components";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";
import { formatDate } from "../../common/date";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";

export type VariantAnalysisStatusStatsProps = {
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
}: VariantAnalysisStatusStatsProps) => {
  return (
    <Container>
      {variantAnalysisStatus === VariantAnalysisStatus.InProgress ||
      variantAnalysisStatus === VariantAnalysisStatus.Canceling ? (
        <div>
          <Icon className="codicon codicon-loading codicon-modifier-spin" />
        </div>
      ) : (
        <span>{completedAt !== undefined ? formatDate(completedAt) : "-"}</span>
      )}
      {onViewLogsClick && (
        <VSCodeLink onClick={onViewLogsClick}>View actions logs</VSCodeLink>
      )}
    </Container>
  );
};
