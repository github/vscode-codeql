import * as React from 'react';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';
import { VariantAnalysisContainer } from './VariantAnalysisContainer';
import { VariantAnalysisHeader } from './VariantAnalysisHeader';

export function VariantAnalysis(): JSX.Element {
  return (
    <VariantAnalysisContainer>
      <VariantAnalysisHeader
        queryName="Example query"
        queryFileName="example.ql"
        status={VariantAnalysisStatus.InProgress}
        onOpenQueryClick={() => void 0}
        onViewQueryClick={() => void 0}
        onStopQueryClick={() => void 0}
        onCopyRepositoryListClick={() => void 0}
        onExportResultsClick={() => void 0}
      />
    </VariantAnalysisContainer>
  );
}
