import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";
import { formatDecimal } from "../../common/number";
import {
  ErrorIcon,
  HorizontalSpace,
  SuccessIcon,
  WarningIcon,
} from "../common";

type Props = {
  variantAnalysisStatus: VariantAnalysisStatus;

  totalRepositoryCount: number;
  completedRepositoryCount: number;
  successfulRepositoryCount: number;
  skippedRepositoryCount: number;
};

function getIcon(
  variantAnalysisStatus: VariantAnalysisStatus,
  completedRepositoryCount: number,
  successfulRepositoryCount: number,
  skippedRepositoryCount: number,
) {
  if (successfulRepositoryCount < completedRepositoryCount) {
    if (variantAnalysisStatus === VariantAnalysisStatus.Canceled) {
      return (
        <>
          <HorizontalSpace $size={2} />
          <ErrorIcon label="Some analyses were stopped" />
        </>
      );
    } else {
      return (
        <>
          <HorizontalSpace $size={2} />
          <ErrorIcon label="Some analyses failed" />
        </>
      );
    }
  } else if (skippedRepositoryCount > 0) {
    return (
      <>
        <HorizontalSpace $size={2} />
        <WarningIcon label="Some repositories were skipped" />
      </>
    );
  } else if (variantAnalysisStatus === VariantAnalysisStatus.Succeeded) {
    return (
      <>
        <HorizontalSpace $size={2} />
        <SuccessIcon label="Completed" />
      </>
    );
  } else {
    return undefined;
  }
}

export const VariantAnalysisRepositoriesStats = ({
  variantAnalysisStatus,
  totalRepositoryCount,
  completedRepositoryCount,
  successfulRepositoryCount,
  skippedRepositoryCount,
}: Props) => {
  if (variantAnalysisStatus === VariantAnalysisStatus.Failed) {
    return (
      <>
        0<HorizontalSpace $size={2} />
        <ErrorIcon label="Variant analysis failed" />
      </>
    );
  }

  return (
    <>
      {formatDecimal(successfulRepositoryCount)}/
      {formatDecimal(totalRepositoryCount)}
      {getIcon(
        variantAnalysisStatus,
        completedRepositoryCount,
        successfulRepositoryCount,
        skippedRepositoryCount,
      )}
    </>
  );
};
