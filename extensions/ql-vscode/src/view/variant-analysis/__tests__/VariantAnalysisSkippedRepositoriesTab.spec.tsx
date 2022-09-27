import * as React from 'react';
import { render as reactRender, screen } from '@testing-library/react';
import { VariantAnalysisSkippedRepositoriesTab, VariantAnalysisSkippedRepositoriesTabProps } from '../VariantAnalysisSkippedRepositoriesTab';

describe(VariantAnalysisSkippedRepositoriesTab.name, () => {
  const render = (props: VariantAnalysisSkippedRepositoriesTabProps) =>
    reactRender(<VariantAnalysisSkippedRepositoriesTab {...props} />);

  it('renders warning title when reason is no_access', async () => {
    render({
      reason: 'no_access',
      skippedRepositoryGroup: {
        repositoryCount: 1,
        repositories: [],
      }
    });

    expect(screen.getByText('Warning: No access')).toBeInTheDocument();
  });

  it('renders warning title when reason is no_database', async () => {
    render({
      reason: 'no_database',
      skippedRepositoryGroup: {
        repositoryCount: 1,
        repositories: [],
      }
    });

    expect(screen.getByText('Warning: No database')).toBeInTheDocument();
  });

  it('renders warning message when no repositories are omitted', async () => {
    render({
      reason: 'no_access',
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
      reason: 'no_access',
      skippedRepositoryGroup: {
        repositoryCount: 44,
        repositories: [
          {
            fullName: 'octodemo/hello-world',
          },
        ],
      }
    });

    expect(screen.getByText('The following repositories could not be scanned because you do not have read access. (Only the first 1 repository is shown.)')).toBeInTheDocument();
  });

  it('renders warning message when there are repositories omitted and multiple shown', async () => {
    render({
      reason: 'no_access',
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
      reason: 'no_database',
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
});
