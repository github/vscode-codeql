import * as React from 'react';
import { useEffect, useState } from 'react';

import {
  VariantAnalysis as VariantAnalysisDomainModel,
  VariantAnalysisScannedRepositoryResult,
} from '../../remote-queries/shared/variant-analysis';
import { VariantAnalysisContainer } from './VariantAnalysisContainer';
import { VariantAnalysisHeader } from './VariantAnalysisHeader';
import { VariantAnalysisOutcomePanels } from './VariantAnalysisOutcomePanels';
import { VariantAnalysisLoading } from './VariantAnalysisLoading';
import { ToVariantAnalysisMessage } from '../../pure/interface-types';
import { vscode } from '../vscode-api';

const repositoryResults: VariantAnalysisScannedRepositoryResult[] = [
  {
    repositoryId: 1,
    rawResults: {
      schema: {
        name: '#select',
        rows: 1,
        columns: [
          {
            kind: 'i'
          }
        ]
      },
      resultSet: {
        schema: {
          name: '#select',
          rows: 1,
          columns: [
            {
              kind: 'i'
            }
          ]
        },
        rows: [
          [
            60688
          ]
        ]
      },
      fileLinkPrefix: 'https://github.com/octodemo/hello-world-1/blob/59a2a6c7d9dde7a6ecb77c2f7e8197d6925c143b',
      sourceLocationPrefix: '/home/runner/work/bulk-builder/bulk-builder',
      capped: false
    }
  }
];

function getContainerContents(variantAnalysis: VariantAnalysisDomainModel) {
  if (variantAnalysis.actionsWorkflowRunId === undefined) {
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
        repositoryResults={repositoryResults}
      />
    </>
  );
}

type Props = {
  variantAnalysis?: VariantAnalysisDomainModel;
}

export function VariantAnalysis({
  variantAnalysis: initialVariantAnalysis,
}: Props): JSX.Element {
  const [variantAnalysis, setVariantAnalysis] = useState<VariantAnalysisDomainModel | undefined>(initialVariantAnalysis);

  useEffect(() => {
    window.addEventListener('message', (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToVariantAnalysisMessage = evt.data;
        if (msg.t === 'setVariantAnalysis') {
          setVariantAnalysis(msg.variantAnalysis);
          vscode.setState({
            variantAnalysisId: msg.variantAnalysis.id,
          });
        }
      } else {
        // sanitize origin
        const origin = evt.origin.replace(/\n|\r/g, '');
        console.error(`Invalid event origin ${origin}`);
      }
    });
  });

  if (!variantAnalysis) {
    return <VariantAnalysisLoading />;
  }

  return (
    <VariantAnalysisContainer>
      {getContainerContents(variantAnalysis)}
    </VariantAnalysisContainer>
  );
}
