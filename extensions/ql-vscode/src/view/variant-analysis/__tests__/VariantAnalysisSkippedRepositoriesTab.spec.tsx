import * as React from 'react';
import { render as reactRender, screen } from '@testing-library/react';
import { VariantAnalysisSkippedRepositoriesTab, VariantAnalysisSkippedRepositoriesTabProps } from '../VariantAnalysisSkippedRepositoriesTab';
import { defaultFilterSortState, SortKey } from '../../../pure/variant-analysis-filter-sort';

describe(VariantAnalysisSkippedRepositoriesTab.name, () => {
  const render = (props: VariantAnalysisSkippedRepositoriesTabProps) =>
    reactRender(<VariantAnalysisSkippedRepositoriesTab {...props} />);

  it('renders warning title', async () => {
    render({
      alertTitle: 'No access',
      alertMessage: 'The following repositories could not be scanned because you do not have read access.',
      skippedRepositoryGroup: {
        repositoryCount: 1,
        repositories: [],
      }
    });

    expect(screen.getByText('Warning: No access')).toBeInTheDocument();
  });

  it('renders warning message when no repositories are omitted', async () => {
    render({
      alertTitle: 'No access',
      alertMessage: 'The following repositories could not be scanned because you do not have read access.',
      skippedRepositoryGroup: {
        repositoryCount: 1,
        repositories: [
          {
            fullName: 'octodemo/hello-world',
          },
        ],
      }
    });

    expect(screen.getByText('The following repositories could not be scanned because you do not have read access.')).toBeInTheDocument();
  });

  it('renders warning message when there are repositories omitted and only one shown', async () => {
    render({
      alertTitle: 'No access',
      alertMessage: 'The following repositories could not be scanned because you do not have read access.',
      skippedRepositoryGroup: {
        repositoryCount: 44,
        repositories: [
          {
            fullName: 'octodemo/hello-world',
          },
        ],
      }
    });

    expect(screen.getByText('The following repositories could not be scanned because you do not have read access. (Only the first repository is shown.)')).toBeInTheDocument();
  });

  it('renders warning message when there are repositories omitted and multiple shown', async () => {
    render({
      alertTitle: 'No access',
      alertMessage: 'The following repositories could not be scanned because you do not have read access.',
      skippedRepositoryGroup: {
        repositoryCount: 44,
        repositories: [
          {
            fullName: 'octodemo/hello-world',
          },
          {
            fullName: 'octodemo/hello-galaxy',
          },
        ],
      }
    });

    expect(screen.getByText('The following repositories could not be scanned because you do not have read access. (Only the first 2 repositories are shown.)')).toBeInTheDocument();
  });

  it('renders multiple skipped repository rows', async () => {
    render({
      alertTitle: 'No database',
      alertMessage: 'The following repositories could not be scanned because they do not have an available CodeQL database.',
      skippedRepositoryGroup: {
        repositoryCount: 1,
        repositories: [
          {
            fullName: 'octodemo/hello-world',
          },
          {
            fullName: 'octodemo/hello-galaxy',
          },
          {
            fullName: 'octodemo/hello-universe',
          },
        ],
      }
    });

    expect(screen.getByText('octodemo/hello-world')).toBeInTheDocument();
    expect(screen.getByText('octodemo/hello-galaxy')).toBeInTheDocument();
    expect(screen.getByText('octodemo/hello-universe')).toBeInTheDocument();
  });

  it('uses the search value', async () => {
    render({
      alertTitle: 'No database',
      alertMessage: 'The following repositories could not be scanned because they do not have an available CodeQL database.',
      skippedRepositoryGroup: {
        repositoryCount: 1,
        repositories: [
          {
            fullName: 'octodemo/hello-world',
          },
          {
            fullName: 'octodemo/hello-galaxy',
          },
          {
            fullName: 'octodemo/hello-universe',
          },
        ],
      },
      filterSortState: {
        ...defaultFilterSortState,
        searchValue: 'world',
      }
    });

    expect(screen.getByText('octodemo/hello-world')).toBeInTheDocument();
    expect(screen.queryByText('octodemo/hello-galaxy')).not.toBeInTheDocument();
    expect(screen.queryByText('octodemo/hello-universe')).not.toBeInTheDocument();
  });

  it('uses the sort key', async () => {
    render({
      alertTitle: 'No database',
      alertMessage: 'The following repositories could not be scanned because they do not have an available CodeQL database.',
      skippedRepositoryGroup: {
        repositoryCount: 1,
        repositories: [
          {
            fullName: 'octodemo/hello-world',
            stargazersCount: 300,
          },
          {
            fullName: 'octodemo/hello-galaxy',
            stargazersCount: 50,
          },
          {
            fullName: 'octodemo/hello-universe',
            stargazersCount: 500,
          },
        ],
      },
      filterSortState: {
        ...defaultFilterSortState,
        sortKey: SortKey.Stars,
      }
    });

    const rows = screen.queryAllByRole('button');

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('octodemo/hello-universe');
    expect(rows[1]).toHaveTextContent('octodemo/hello-world');
    expect(rows[2]).toHaveTextContent('octodemo/hello-galaxy');
  });

  it('does not use the result count sort key', async () => {
    render({
      alertTitle: 'No database',
      alertMessage: 'The following repositories could not be scanned because they do not have an available CodeQL database.',
      skippedRepositoryGroup: {
        repositoryCount: 1,
        repositories: [
          {
            fullName: 'octodemo/hello-world',
          },
          {
            fullName: 'octodemo/hello-galaxy',
          },
          {
            fullName: 'octodemo/hello-universe',
          },
        ],
      },
      filterSortState: {
        ...defaultFilterSortState,
        sortKey: SortKey.ResultsCount,
      }
    });

    const rows = screen.queryAllByRole('button');

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('octodemo/hello-galaxy');
    expect(rows[1]).toHaveTextContent('octodemo/hello-universe');
    expect(rows[2]).toHaveTextContent('octodemo/hello-world');
  });
});
