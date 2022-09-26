import * as React from 'react';

import {
  VariantAnalysis as VariantAnalysisDomainModel,
  VariantAnalysisQueryLanguage,
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus
} from '../../remote-queries/shared/variant-analysis';
import { VariantAnalysisContainer } from './VariantAnalysisContainer';
import { VariantAnalysisHeader } from './VariantAnalysisHeader';
import { VariantAnalysisOutcomePanels } from './VariantAnalysisOutcomePanels';

const variantAnalysis: VariantAnalysisDomainModel = {
  id: 1,
  controllerRepoId: 1,
  actionsWorkflowRunId: 789263,
  query: {
    name: 'Example query',
    filePath: 'example.ql',
    language: VariantAnalysisQueryLanguage.Javascript,
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
    {
      repository: {
        id: 2,
        fullName: 'octodemo/hello-world-2',
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        id: 3,
        fullName: 'octodemo/hello-world-3',
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        id: 4,
        fullName: 'octodemo/hello-world-4',
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        id: 5,
        fullName: 'octodemo/hello-world-5',
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        id: 6,
        fullName: 'octodemo/hello-world-6',
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        id: 7,
        fullName: 'octodemo/hello-world-7',
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        id: 8,
        fullName: 'octodemo/hello-world-8',
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        id: 9,
        fullName: 'octodemo/hello-world-9',
        private: false,
      },
      analysisStatus: VariantAnalysisRepoStatus.Pending,
    },
    {
      repository: {
        id: 10,
        fullName: 'octodemo/hello-world-10',
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

export function VariantAnalysis(): JSX.Element {
  return (
    <VariantAnalysisContainer>
      <VariantAnalysisHeader
        variantAnalysis={variantAnalysis}
        onOpenQueryFileClick={() => console.log('Open query')}
        onViewQueryTextClick={() => console.log('View query')}
        onStopQueryClick={() => console.log('Stop query')}
        onCopyRepositoryListClick={() => console.log('Copy repository list')}
        onExportResultsClick={() => console.log('Export results')}
        onViewLogsClick={() => console.log('View logs')}
      />
      <VariantAnalysisOutcomePanels variantAnalysis={variantAnalysis} />
    </VariantAnalysisContainer>
  );
}
