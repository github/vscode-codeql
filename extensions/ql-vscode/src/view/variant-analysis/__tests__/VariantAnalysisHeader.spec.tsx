import * as React from 'react';
import { VariantAnalysisHeader } from '../VariantAnalysisHeader';
import { render } from '@testing-library/react';
import { VariantAnalysisStatus } from '../../../remote-queries/shared/variant-analysis';

describe(VariantAnalysisHeader.name, () => {
  it('renders correctly', () => {
    render(
      <VariantAnalysisHeader
        queryName="Query name"
        queryFileName="example.ql"
        status={VariantAnalysisStatus.InProgress}
        onOpenQueryClick={jest.fn()}
        onViewQueryClick={jest.fn()}
        onStopQueryClick={jest.fn()}
        onCopyRepositoryListClick={jest.fn()}
        onExportResultsClick={jest.fn()}
      />
    );
  });
});
