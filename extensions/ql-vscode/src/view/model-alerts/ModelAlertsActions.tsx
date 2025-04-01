import { styled } from "styled-components";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";
import { VscodeButton } from "@vscode-elements/react-elements";

type ModelAlertsActionsProps = {
  variantAnalysisStatus: VariantAnalysisStatus;

  onStopRunClick: () => void;
};

const Container = styled.div`
  margin-left: auto;
  display: flex;
  gap: 1em;
`;

const Button = styled(VscodeButton)`
  white-space: nowrap;
`;

export const ModelAlertsActions = ({
  variantAnalysisStatus,
  onStopRunClick,
}: ModelAlertsActionsProps) => {
  return (
    <Container>
      {variantAnalysisStatus === VariantAnalysisStatus.InProgress && (
        <Button appearance="secondary" onClick={onStopRunClick}>
          Stop evaluation
        </Button>
      )}
      {variantAnalysisStatus === VariantAnalysisStatus.Canceling && (
        <Button appearance="secondary" disabled={true}>
          Stopping evaluation
        </Button>
      )}
    </Container>
  );
};
