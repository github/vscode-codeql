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
        variantAnalysisStatus={VariantAnalysisStatus.InProgress}
        onOpenQueryFileClick={() => console.log('Open query')}
        onViewQueryTextClick={() => console.log('View query')}
        onStopQueryClick={() => console.log('Stop query')}
        onCopyRepositoryListClick={() => console.log('Copy repository list')}
        onExportResultsClick={() => console.log('Export results')}
      />
    </VariantAnalysisContainer>
  );
}
