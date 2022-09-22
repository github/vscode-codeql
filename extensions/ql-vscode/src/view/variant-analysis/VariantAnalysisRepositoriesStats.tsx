import * as React from 'react';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';
import { formatDecimal } from '../../pure/number';
import { ErrorIcon, HorizontalSpace, SuccessIcon, WarningIcon } from '../common';

type Props = {
  variantAnalysisStatus: VariantAnalysisStatus;

  totalRepositoryCount: number;
  completedRepositoryCount?: number | undefined;

  queryResult?: 'warning' | 'stopped';
};

export const VariantAnalysisRepositoriesStats = ({
  variantAnalysisStatus,
  totalRepositoryCount,
  completedRepositoryCount = 0,
  queryResult,
}: Props) => {
  if (variantAnalysisStatus === VariantAnalysisStatus.Failed) {
    return (
      <>
        0<HorizontalSpace size={2} /><ErrorIcon />
      </>
    );
  }

  return (
    <>
      {formatDecimal(completedRepositoryCount)}/{formatDecimal(totalRepositoryCount)}
      {queryResult && <><HorizontalSpace size={2} /><WarningIcon /></>}
      {!queryResult && variantAnalysisStatus === VariantAnalysisStatus.Succeeded &&
        <><HorizontalSpace size={2} /><SuccessIcon label="Completed" /></>}
    </>
  );
};
