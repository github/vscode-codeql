import * as React from 'react';
import { render as reactRender, screen } from '@testing-library/react';
import { VariantAnalysisStatus } from '../../../remote-queries/shared/variant-analysis';
import { VariantAnalysisStats, VariantAnalysisStatsProps } from '../VariantAnalysisStats';
import { userEvent } from '@storybook/testing-library';

describe(VariantAnalysisStats.name, () => {
  const onViewLogsClick = jest.fn();

  afterEach(() => {
    onViewLogsClick.mockReset();
  });

  const render = (props: Partial<VariantAnalysisStatsProps> = {}) =>
    reactRender(
      <VariantAnalysisStats
        variantAnalysisStatus={VariantAnalysisStatus.InProgress}
        totalRepositoryCount={10}
        onViewLogsClick={onViewLogsClick}
        {...props}
      />
    );

  it('renders correctly', () => {
    render();

    expect(screen.getByText('Results')).toBeInTheDocument();
  });

  it('renders the number of results as a formatted number', () => {
    render({ resultCount: 123456 });

    expect(screen.getByText('123,456')).toBeInTheDocument();
  });

  it('renders the number of repositories as a formatted number', () => {
    render({ totalRepositoryCount: 123456, completedRepositoryCount: 654321 });

    expect(screen.getByText('654,321/123,456')).toBeInTheDocument();
  });

  it('renders a warning icon when has warnings is set', () => {
    render({ hasWarnings: true });

    expect(screen.getByRole('img', {
      name: 'Warning',
    })).toBeInTheDocument();
  });

  it('renders an error icon when the variant analysis status is failed', () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Failed });

    expect(screen.getByRole('img', {
      name: 'Error',
    })).toBeInTheDocument();
  });

  it('renders a completed icon when the variant analysis status is succeeded', () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Succeeded });

    expect(screen.getByRole('img', {
      name: 'Completed',
    })).toBeInTheDocument();
  });

  it('renders a view logs link when the variant analysis status is succeeded', () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Succeeded, completedAt: new Date() });

    userEvent.click(screen.getByText('View logs'));
    expect(onViewLogsClick).toHaveBeenCalledTimes(1);
  });

  it('renders a running text when the variant analysis status is in progress', () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.InProgress });

    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('renders a failed text when the variant analysis status is failed', () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Failed });

    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders a stopped text when the variant analysis status is canceled', () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Canceled });

    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('renders a succeeded warnings text when the variant analysis status is succeeded and has warnings', () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Succeeded, hasWarnings: true });

    expect(screen.getByText('Succeeded warnings')).toBeInTheDocument();
  });

  it('renders a succeeded text when the variant analysis status is succeeded', () => {
    render({ variantAnalysisStatus: VariantAnalysisStatus.Succeeded });

    expect(screen.getByText('Succeeded')).toBeInTheDocument();
    expect(screen.queryByText('Succeeded warnings')).not.toBeInTheDocument();
  });
});
