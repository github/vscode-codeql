import * as React from 'react';
import { VariantAnalysisHeader, VariantAnalysisHeaderProps } from '../VariantAnalysisHeader';
import { render as reactRender, screen } from '@testing-library/react';
import { VariantAnalysisStatus } from '../../../remote-queries/shared/variant-analysis';
import { userEvent } from '@storybook/testing-library';

describe(VariantAnalysisHeader.name, () => {
  const onOpenQueryClick = jest.fn();
  const onViewQueryClick = jest.fn();
  const onStopQueryClick = jest.fn();
  const onCopyRepositoryListClick = jest.fn();
  const onExportResultsClick = jest.fn();

  afterEach(() => {
    onOpenQueryClick.mockReset();
    onViewQueryClick.mockReset();
    onStopQueryClick.mockReset();
    onCopyRepositoryListClick.mockReset();
    onExportResultsClick.mockReset();
  });

  const render = (props: Partial<VariantAnalysisHeaderProps> = {}) =>
    reactRender(
      <VariantAnalysisHeader
        queryName="Query name"
        queryFileName="example.ql"
        status={VariantAnalysisStatus.InProgress}
        onOpenQueryClick={onOpenQueryClick}
        onViewQueryClick={onViewQueryClick}
        onStopQueryClick={onStopQueryClick}
        onCopyRepositoryListClick={onCopyRepositoryListClick}
        onExportResultsClick={onExportResultsClick}
        {...props}
      />
    );

  it('renders correctly', () => {
    render();

    expect(screen.getByText('Query name')).toBeInTheDocument();
  });

  it('renders the query file name as a button', () => {
    render();

    userEvent.click(screen.getByText('example.ql'));
    expect(onOpenQueryClick).toHaveBeenCalledTimes(1);
  });

  it('renders a view query button', () => {
    render();

    userEvent.click(screen.getByText('View query'));
    expect(onViewQueryClick).toHaveBeenCalledTimes(1);
  });

  it('renders the stop query button when in progress', () => {
    render({ status: VariantAnalysisStatus.InProgress });

    userEvent.click(screen.getByText('Stop query'));
    expect(onStopQueryClick).toHaveBeenCalledTimes(1);
  });

  it('renders the copy repository list button when succeeded', () => {
    render({ status: VariantAnalysisStatus.Succeeded });

    userEvent.click(screen.getByText('Copy repository list'));
    expect(onCopyRepositoryListClick).toHaveBeenCalledTimes(1);
  });

  it('renders the export results button when succeeded', () => {
    render({ status: VariantAnalysisStatus.Succeeded });

    userEvent.click(screen.getByText('Export results'));
    expect(onExportResultsClick).toHaveBeenCalledTimes(1);
  });

  it('does not render any buttons when failed', () => {
    const { container } = render({ status: VariantAnalysisStatus.Failed });

    expect(container.querySelectorAll('vscode-button').length).toEqual(0);
  });
});
