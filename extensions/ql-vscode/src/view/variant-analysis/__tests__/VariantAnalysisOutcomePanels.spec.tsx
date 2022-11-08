import * as React from 'react';
import { render as reactRender, screen } from '@testing-library/react';
import {
  VariantAnalysis,
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus
} from '../../../remote-queries/shared/variant-analysis';
import { VariantAnalysisOutcomePanelProps, VariantAnalysisOutcomePanels } from '../VariantAnalysisOutcomePanels';
import { createMockVariantAnalysis } from '../../../vscode-tests/factories/remote-queries/shared/variant-analysis';
import { createMockRepositoryWithMetadata } from '../../../vscode-tests/factories/remote-queries/shared/repository';
import { createMockScannedRepo } from '../../../vscode-tests/factories/remote-queries/shared/scanned-repositories';

describe(VariantAnalysisOutcomePanels.name, () => {
  const defaultVariantAnalysis = {
    ...createMockVariantAnalysis({ status: VariantAnalysisStatus.InProgress }),
    controllerRepo: {
      id: 1,
      fullName: 'octodemo/variant-analysis-controller',
      private: false,
    },
    actionsWorkflowRunId: 789263,
    executionStartTime: 1611234567890,
    createdAt: '2021-01-21T13:09:27.890Z',
    updatedAt: '2021-01-21T13:09:27.890Z',
    status: VariantAnalysisStatus.InProgress,
    scannedRepos: [
      {
        ...createMockScannedRepo(),
        repository: {
          ...createMockRepositoryWithMetadata(),
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
          createMockRepositoryWithMetadata(),
          createMockRepositoryWithMetadata(),
          createMockRepositoryWithMetadata(),
          createMockRepositoryWithMetadata()
        ]
      },
      overLimitRepos: {
        repositoryCount: 1,
        repositories: [
          createMockRepositoryWithMetadata()
        ]
      },
      accessMismatchRepos: {
        repositoryCount: 1,
        repositories: [
          createMockRepositoryWithMetadata()
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

  it('renders warning with canceled variant analysis', () => {
    render({
      status: VariantAnalysisStatus.Canceled,
    });

    expect(screen.getByText('Warning: Query manually stopped')).toBeInTheDocument();
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
