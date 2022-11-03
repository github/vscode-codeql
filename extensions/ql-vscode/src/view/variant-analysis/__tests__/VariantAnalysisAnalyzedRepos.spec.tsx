import * as React from 'react';
import { render as reactRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus
} from '../../../remote-queries/shared/variant-analysis';
import { VariantAnalysisAnalyzedRepos, VariantAnalysisAnalyzedReposProps } from '../VariantAnalysisAnalyzedRepos';
import { createMockVariantAnalysis } from '../../../vscode-tests/factories/remote-queries/shared/variant-analysis';
import { createMockRepositoryWithMetadata } from '../../../vscode-tests/factories/remote-queries/shared/repository';
import { createMockScannedRepo } from '../../../vscode-tests/factories/remote-queries/shared/scanned-repositories';

describe(VariantAnalysisAnalyzedRepos.name, () => {
  const defaultVariantAnalysis = createMockVariantAnalysis(VariantAnalysisStatus.InProgress, [
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
    {
      ...createMockScannedRepo(),
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 2,
        fullName: 'octodemo/hello-world-2',
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Succeeded,
    },
    {
      ...createMockScannedRepo(),
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 3,
        fullName: 'octodemo/hello-world-3',
        private: true,
      },
      analysisStatus: VariantAnalysisRepoStatus.Failed,
    },
    {
      ...createMockScannedRepo(),
      repository: {
        ...createMockRepositoryWithMetadata(),
        id: 4,
        fullName: 'octodemo/hello-world-4',
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.InProgress,
    },
  ]);

  const render = (props: Partial<VariantAnalysisAnalyzedReposProps> = {}) => {
    return reactRender(
      <VariantAnalysisAnalyzedRepos
        variantAnalysis={defaultVariantAnalysis}
        {...props}
      />
    );
  };

  it('renders the repository names', () => {
    render();

    expect(screen.getByText('octodemo/hello-world-1')).toBeInTheDocument();
    expect(screen.getByText('octodemo/hello-world-2')).toBeInTheDocument();
    expect(screen.getByText('octodemo/hello-world-3')).toBeInTheDocument();
    expect(screen.getByText('octodemo/hello-world-4')).toBeInTheDocument();
  });

  it('renders the interpreted result for a succeeded repo', async () => {
    render({
      repositoryResults: [
        {
          variantAnalysisId: 1,
          repositoryId: 2,
          interpretedResults: [
            {
              message: {
                tokens: [
                  {
                    t: 'text',
                    text: 'This is an empty block.'
                  }
                ]
              },
              shortDescription: 'This is an empty block.',
              fileLink: {
                fileLinkPrefix: 'https://github.com/facebook/create-react-app/blob/f34d88e30c7d8be7181f728d1abc4fd8d5cd07d3',
                filePath: 'packages/create-react-app/createReactApp.js'
              },
              severity: 'Warning',
              codeFlows: []
            }
          ],
        }
      ]
    });

    expect(screen.queryByText('This is an empty block.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {
      name: /octodemo\/hello-world-2/,
    }));
    expect(screen.getByText('This is an empty block.')).toBeInTheDocument();
  });
});
