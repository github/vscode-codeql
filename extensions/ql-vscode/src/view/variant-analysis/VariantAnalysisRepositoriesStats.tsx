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
  completedRepositoryCount?: number | undefined;

  showWarning?: boolean;
};

export const VariantAnalysisRepositoriesStats = ({
  variantAnalysisStatus,
  totalRepositoryCount,
  completedRepositoryCount = 0,
  showWarning,
}: Props) => {
  if (variantAnalysisStatus === VariantAnalysisStatus.Failed) {
    return (
      <>
        0<HorizontalSpace size={2} />
        <ErrorIcon />
      </>
    );
  }

  return (
    <>
      {formatDecimal(completedRepositoryCount)}/
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
