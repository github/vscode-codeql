import * as React from 'react';
import { render as reactRender, screen } from '@testing-library/react';
import {
  VariantAnalysis,
  VariantAnalysisQueryLanguage, VariantAnalysisRepoStatus,
  VariantAnalysisStatus
} from '../../../remote-queries/shared/variant-analysis';
import { VariantAnalysisOutcomePanelProps, VariantAnalysisOutcomePanels } from '../VariantAnalysisOutcomePanels';

describe(VariantAnalysisOutcomePanels.name, () => {
  const defaultVariantAnalysis = {
    id: 1,
    controllerRepoId: 1,
    actionsWorkflowRunId: 789263,
    query: {
      name: 'Example query',
      filePath: 'example.ql',
      language: VariantAnalysisQueryLanguage.Javascript,
      text: 'import javascript\nselect 1',
    },
    databases: {},
    status: VariantAnalysisStatus.InProgress,
    scannedRepos: [
      {
        repository: {
          id: 1,
          fullName: 'octodemo/hello-world-1',
          private: false,
        },
        analysisStatus: VariantAnalysisRepoStatus.Pending,
      },
    ],
    skippedRepos: {
      notFoundRepos: {
        repositoryCount: 2,
        repositories: [
          {
            fullName: 'octodemo/hello-globe'
          },
          {
            fullName: 'octodemo/hello-planet'
          }
        ]
      },
      noCodeqlDbRepos: {
        repositoryCount: 4,
        repositories: [
          {
            id: 100,
            fullName: 'octodemo/no-db-1'
          },
          {
            id: 101,
            fullName: 'octodemo/no-db-2'
          },
          {
            id: 102,
            fullName: 'octodemo/no-db-3'
          },
          {
            id: 103,
            fullName: 'octodemo/no-db-4'
          }
        ]
      },
      overLimitRepos: {
        repositoryCount: 1,
        repositories: [
          {
            id: 201,
            fullName: 'octodemo/over-limit-1'
          }
        ]
      },
      accessMismatchRepos: {
        repositoryCount: 1,
        repositories: [
          {
            id: 205,
            fullName: 'octodemo/private'
          }
        ]
      }
    },
  };

  const render = (variantAnalysis: Partial<VariantAnalysis> = {}, props: Partial<VariantAnalysisOutcomePanelProps> = {}) => {
    return reactRender(
      <VariantAnalysisOutcomePanels
        variantAnalysis={{
          ...defaultVariantAnalysis,
          ...variantAnalysis,
        }}
        {...props}
      />
    );
  };

  it('renders correctly', () => {
    render();

    expect(screen.getByText('Analyzed')).toBeInTheDocument();
  });

  it('does not render panels without skipped repos', () => {
    render({
      skippedRepos: undefined,
    });

    expect(screen.queryByText('Analyzed')).not.toBeInTheDocument();
    expect(screen.queryByText('No access')).not.toBeInTheDocument();
    expect(screen.queryByText('No database')).not.toBeInTheDocument();
  });

  it('renders panels with not found repos', () => {
    render({
      skippedRepos: {
        notFoundRepos: defaultVariantAnalysis.skippedRepos.notFoundRepos,
      },
    });

    expect(screen.getByText('Analyzed')).toBeInTheDocument();
    expect(screen.getByText('No access')).toBeInTheDocument();
    expect(screen.queryByText('No database')).not.toBeInTheDocument();
  });

  it('renders panels with no database repos', () => {
    render({
      skippedRepos: {
        noCodeqlDbRepos: defaultVariantAnalysis.skippedRepos.noCodeqlDbRepos,
      },
    });

    expect(screen.getByText('Analyzed')).toBeInTheDocument();
    expect(screen.queryByText('No access')).not.toBeInTheDocument();
    expect(screen.getByText('No database')).toBeInTheDocument();
  });

  it('renders panels with not found and no database repos', () => {
    render({
      skippedRepos: {
        notFoundRepos: defaultVariantAnalysis.skippedRepos.notFoundRepos,
        noCodeqlDbRepos: defaultVariantAnalysis.skippedRepos.noCodeqlDbRepos,
      },
    });

    expect(screen.getByText('Analyzed')).toBeInTheDocument();
    expect(screen.getByText('No access')).toBeInTheDocument();
    expect(screen.getByText('No database')).toBeInTheDocument();
  });

  it('renders warning with access mismatch repos', () => {
    render({
      skippedRepos: {
        notFoundRepos: defaultVariantAnalysis.skippedRepos.notFoundRepos,
        accessMismatchRepos: defaultVariantAnalysis.skippedRepos.accessMismatchRepos,
      },
    });

    expect(screen.getByText('Warning: Access mismatch')).toBeInTheDocument();
  });

  it('renders warning with over limit repos', () => {
    render({
      skippedRepos: {
        overLimitRepos: defaultVariantAnalysis.skippedRepos.overLimitRepos,
      },
    });

    expect(screen.getByText('Warning: Repository limit exceeded')).toBeInTheDocument();
  });

  it('renders singulars in warnings', () => {
    render({
      skippedRepos: {
        overLimitRepos: {
          repositoryCount: 1,
          repositories: defaultVariantAnalysis.skippedRepos.overLimitRepos.repositories,
        },
        accessMismatchRepos: {
          repositoryCount: 1,
          repositories: defaultVariantAnalysis.skippedRepos.overLimitRepos.repositories,
        }
      },
    });

    expect(screen.getByText('The number of requested repositories exceeds the maximum number of repositories supported by multi-repository variant analysis. 1 repository was skipped.')).toBeInTheDocument();
    expect(screen.getByText('1 repository is private, while the controller repository is public. This repository was skipped.')).toBeInTheDocument();
  });

  it('renders plurals in warnings', () => {
    render({
      skippedRepos: {
        overLimitRepos: {
          repositoryCount: 2,
          repositories: defaultVariantAnalysis.skippedRepos.overLimitRepos.repositories,
        },
        accessMismatchRepos: {
          repositoryCount: 2,
          repositories: defaultVariantAnalysis.skippedRepos.overLimitRepos.repositories,
        }
      },
    });

    expect(screen.getByText('The number of requested repositories exceeds the maximum number of repositories supported by multi-repository variant analysis. 2 repositories were skipped.')).toBeInTheDocument();
    expect(screen.getByText('2 repositories are private, while the controller repository is public. These repositories were skipped.')).toBeInTheDocument();
  });
});
