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

  it('renders a warning icon when the query result is a warning', () => {
    render({ queryResult: 'warning' });

    expect(screen.getByRole('img', {
      name: 'Warning',
    })).toBeInTheDocument();
  });

  it('renders a warning icon when the query result is stopped', () => {
    render({ queryResult: 'stopped' });

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
});
