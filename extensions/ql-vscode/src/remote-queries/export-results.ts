import { window, commands, Uri, ExtensionContext, QuickPickItem } from 'vscode';
import { Credentials } from '../authentication';
import { UserCancellationException } from '../commandRunner';
import { showInformationMessageWithAction, showAndLogInformationMessage } from '../helpers';
import { logger } from '../logging';
import { QueryHistoryManager } from '../query-history';
import { createGist } from './gh-actions-api-client';
import { RemoteQueriesManager } from './remote-queries-manager';
import { generateMarkdown } from './remote-queries-markdown-generation';
import { RemoteQuery } from './remote-query';
import { AnalysisResults } from './shared/analysis-result';

/**
 * Exports the results of the currently-selected remote query.
 * The user is prompted to select the export format.
 */
export async function exportRemoteQueryResults(
  queryHistoryManager: QueryHistoryManager,
  remoteQueriesManager: RemoteQueriesManager,
  ctx: ExtensionContext,
): Promise<void> {
  const queryHistoryItem = queryHistoryManager.getCurrentQueryHistoryItem();
  if (!queryHistoryItem || queryHistoryItem.t !== 'remote') {
    throw new Error('No variant analysis results currently open. To open results, click an item in the query history view.');
  } else if (!queryHistoryItem.completed) {
    throw new Error('Variant analysis results are not yet available.');
  }
  const queryId = queryHistoryItem.queryId;
  void logger.log(`Exporting variant analysis results for query: ${queryId}`);
  const query = queryHistoryItem.remoteQuery;
  const analysesResults = remoteQueriesManager.getAnalysesResults(queryId);

  const gistOption = {
    label: '$(ports-open-browser-icon) Create Gist (GitHub)',
  };
  const localMarkdownOption = {
    label: '$(markdown) Save as markdown',
  };
  const exportFormat = await determineExportFormat(gistOption, localMarkdownOption);

  if (exportFormat === gistOption) {
    await exportResultsToGist(ctx, query, analysesResults);
  } else if (exportFormat === localMarkdownOption) {
    // TODO: Write function that creates local markdown files
    // const markdownFiles = generateMarkdown(query, analysesResults, 'local');
    void showAndLogInformationMessage('Local markdown export not yet available');
  }
}

/**
 * Determines the format in which to export the results, from the given export options.
 */
async function determineExportFormat(
  ...options: { label: string }[]
): Promise<QuickPickItem> {
  const exportFormat = await window.showQuickPick(
    options,
    {
      placeHolder: 'Select export format',
      canPickMany: false,
      ignoreFocusOut: true,
    }
  );
  if (!exportFormat || !exportFormat.label) {
    throw new UserCancellationException('No export format selected', true);
  }
  return exportFormat;
}

/**
 * Converts the results of a remote query to markdown and uploads the files as a secret gist.
 */
async function exportResultsToGist(
  ctx: ExtensionContext,
  query: RemoteQuery,
  analysesResults: AnalysisResults[]
): Promise<void> {
  const credentials = await Credentials.initialize(ctx);
  const description = 'CodeQL Variant Analysis Results';
  const markdownFiles = generateMarkdown(query, analysesResults, 'gist');
  // Convert markdownFiles to the appropriate format for uploading to gist
  const gistFiles = markdownFiles.reduce((acc, cur) => {
    acc[`${cur.fileName}.md`] = { content: cur.content.join('\n') };
    return acc;
  }, {} as { [key: string]: { content: string } });

  const gistUrl = await createGist(credentials, description, gistFiles);
  if (gistUrl) {
    const shouldOpenGist = await showInformationMessageWithAction(
      'Variant analysis results exported to gist.',
      'Open gist'
    );
    if (shouldOpenGist) {
      await commands.executeCommand('vscode.open', Uri.parse(gistUrl));
    }
  }
}
