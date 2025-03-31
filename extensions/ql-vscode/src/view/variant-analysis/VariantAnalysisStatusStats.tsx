import { styled } from "styled-components";
import { formatDate } from "../../common/date";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";
import { Link } from "../common/Link";

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
        <Link onClick={onViewLogsClick}>View actions logs</Link>
      )}
    </Container>
  );
};
