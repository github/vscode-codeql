import * as React from 'react';
import { useEffect, useState } from 'react';

import {
  VariantAnalysis as VariantAnalysisDomainModel,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from '../../remote-queries/shared/variant-analysis';
import { VariantAnalysisHeader } from './VariantAnalysisHeader';
import { VariantAnalysisOutcomePanels } from './VariantAnalysisOutcomePanels';
import { VariantAnalysisLoading } from './VariantAnalysisLoading';
import { ToVariantAnalysisMessage } from '../../pure/interface-types';
import { vscode } from '../vscode-api';

type Props = {
  variantAnalysis?: VariantAnalysisDomainModel;
  repoStates?: VariantAnalysisScannedRepositoryState[];
  repoResults?: VariantAnalysisScannedRepositoryResult[];
}

export function VariantAnalysis({
  variantAnalysis: initialVariantAnalysis,
  repoStates: initialRepoStates = [],
  repoResults: initialRepoResults = [],
}: Props): JSX.Element {
  const [variantAnalysis, setVariantAnalysis] = useState<VariantAnalysisDomainModel | undefined>(initialVariantAnalysis);
  const [repoStates, setRepoStates] = useState<VariantAnalysisScannedRepositoryState[]>(initialRepoStates);
  const [repoResults, setRepoResults] = useState<VariantAnalysisScannedRepositoryResult[]>(initialRepoResults);

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToVariantAnalysisMessage = evt.data;
        if (msg.t === 'setVariantAnalysis') {
          setVariantAnalysis(msg.variantAnalysis);
          vscode.setState({
            variantAnalysisId: msg.variantAnalysis.id,
          });
        } else if (msg.t === 'setRepoResults') {
          setRepoResults(oldRepoResults => {
            const newRepoIds = msg.repoResults.map(r => r.repositoryId);
            return [...oldRepoResults.filter(v => !newRepoIds.includes(v.repositoryId)), ...msg.repoResults];
          });
        } else if (msg.t === 'setRepoStates') {
          setRepoStates(oldRepoStates => {
            const newRepoIds = msg.repoStates.map(r => r.repositoryId);
            return [...oldRepoStates.filter(v => !newRepoIds.includes(v.repositoryId)), ...msg.repoStates];
          });
        }
      } else {
        // sanitize origin
        const origin = evt.origin.replace(/\n|\r/g, '');
        console.error(`Invalid event origin ${origin}`);
      }
    };
    window.addEventListener('message', listener);

    return () => {
      window.removeEventListener('message', listener);
    };
  }, []);

  if (variantAnalysis?.actionsWorkflowRunId === undefined) {
    return <VariantAnalysisLoading />;
  }

  return (
    <>
      <VariantAnalysisHeader
        variantAnalysis={variantAnalysis}
        onOpenQueryFileClick={() => console.log('Open query')}
        onViewQueryTextClick={() => console.log('View query')}
        onStopQueryClick={() => console.log('Stop query')}
        onCopyRepositoryListClick={() => console.log('Copy repository list')}
        onExportResultsClick={() => console.log('Export results')}
        onViewLogsClick={() => console.log('View logs')}
      />
      <VariantAnalysisOutcomePanels
        variantAnalysis={variantAnalysis}
        repositoryStates={repoStates}
        repositoryResults={repoResults}
      />
    </>
  );
}
