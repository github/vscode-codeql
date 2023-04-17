import * as React from "react";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";
import { formatDecimal } from "../../pure/number";
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
        0<HorizontalSpace size={2} />
        <ErrorIcon />
      </>
    );
  }

  const showWarning = skippedRepositoryCount > 0;

  return (
    <>
      {formatDecimal(successfulRepositoryCount)}/
      {formatDecimal(totalRepositoryCount)}
      {showWarning && (
        <>
          <HorizontalSpace size={2} />
          <WarningIcon />
        </>
      )}
      {!showWarning &&
        variantAnalysisStatus === VariantAnalysisStatus.Succeeded && (
          <>
            <HorizontalSpace size={2} />
            <SuccessIcon label="Completed" />
          </>
        )}
    </>
  );
};
