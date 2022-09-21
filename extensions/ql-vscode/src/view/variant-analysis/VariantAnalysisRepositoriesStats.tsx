import * as React from 'react';
import styled from 'styled-components';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';
import { formatDecimal } from '../../pure/number';
import { CodiconIcon, ErrorIcon, SuccessIcon, WarningIcon } from '../common';

const Container = styled.div`
  ${CodiconIcon} {
    margin-left: 0.3em;
  }
`;

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
        0<ErrorIcon />
      </>
    );
  }

  return (
    <Container>
      {formatDecimal(completedRepositoryCount)}/{formatDecimal(totalRepositoryCount)}
      {queryResult && <WarningIcon />}
      {!queryResult && variantAnalysisStatus === VariantAnalysisStatus.Succeeded &&
        <SuccessIcon label="Completed" />}
    </Container>
  );
};
