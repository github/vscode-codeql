import * as path from 'path';
import * as fs from 'fs-extra';

import { window, commands, Uri, ExtensionContext, QuickPickItem, workspace, ViewColumn } from 'vscode';
import { Credentials } from '../authentication';
import { UserCancellationException } from '../commandRunner';
import { showInformationMessageWithAction } from '../helpers';
import { logger } from '../logging';
import { QueryHistoryManager } from '../query-history';
import { createGist } from './gh-api/gh-api-client';
import { RemoteQueriesManager } from './remote-queries-manager';
import { generateMarkdown } from './remote-queries-markdown-generation';
import { RemoteQuery } from './remote-query';
import { AnalysisResults, sumAnalysesResults } from './shared/analysis-result';
import { RemoteQueryHistoryItem } from './remote-query-history-item';
import { pluralize } from '../pure/word';

/**
 * Exports the results of the given or currently-selected remote query.
 * The user is prompted to select the export format.
 */
export async function exportRemoteQueryResults(
  queryHistoryManager: QueryHistoryManager,
  remoteQueriesManager: RemoteQueriesManager,
  ctx: ExtensionContext,
  queryId?: string,
): Promise<void> {
  let queryHistoryItem: RemoteQueryHistoryItem;
  if (queryId) {
    const query = queryHistoryManager.getRemoteQueryById(queryId);
    if (!query) {
      void logger.log(`Could not find query with id ${queryId}`);
      throw new Error('There was an error when trying to retrieve variant analysis information');
    }
    queryHistoryItem = query;
  } else {
    const query = queryHistoryManager.getCurrentQueryHistoryItem();
    if (!query || query.t !== 'remote') {
      throw new Error('No variant analysis results currently open. To open results, click an item in the query history view.');
    }
    queryHistoryItem = query;
  }

  if (!queryHistoryItem.completed) {
    throw new Error('Variant analysis results are not yet available.');
  }

  void logger.log(`Exporting variant analysis results for query: ${queryHistoryItem.queryId}`);
  const query = queryHistoryItem.remoteQuery;
  const analysesResults = remoteQueriesManager.getAnalysesResults(queryHistoryItem.queryId);

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
    const queryDirectoryPath = await queryHistoryManager.getQueryHistoryItemDirectory(
      queryHistoryItem
    );
    await exportResultsToLocalMarkdown(queryDirectoryPath, query, analysesResults);
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
export async function exportResultsToGist(
  ctx: ExtensionContext,
  query: RemoteQuery,
  analysesResults: AnalysisResults[]
): Promise<void> {
  const credentials = await Credentials.initialize(ctx);
  const description = buildGistDescription(query, analysesResults);
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

/**
 * Builds Gist description
 * Ex: Empty Block (Go) x results (y repositories)
 */
const buildGistDescription = (query: RemoteQuery, analysesResults: AnalysisResults[]) => {
  const resultCount = sumAnalysesResults(analysesResults);
  const resultLabel = pluralize(resultCount, 'result', 'results');
  const repositoryLabel = query.repositoryCount ? `(${pluralize(query.repositoryCount, 'repository', 'repositories')})` : '';
  return `${query.queryName} (${query.language}) ${resultLabel} ${repositoryLabel}`;
};

/**
 * Converts the results of a remote query to markdown and saves the files locally
 * in the query directory (where query results and metadata are also saved).
 */
async function exportResultsToLocalMarkdown(
  queryDirectoryPath: string,
  query: RemoteQuery,
  analysesResults: AnalysisResults[]
) {
  const markdownFiles = generateMarkdown(query, analysesResults, 'local');
  const exportedResultsPath = path.join(queryDirectoryPath, 'exported-results');
  await fs.ensureDir(exportedResultsPath);
  for (const markdownFile of markdownFiles) {
    const filePath = path.join(exportedResultsPath, `${markdownFile.fileName}.md`);
    await fs.writeFile(filePath, markdownFile.content.join('\n'), 'utf8');
  }
  const shouldOpenExportedResults = await showInformationMessageWithAction(
    `Variant analysis results exported to \"${exportedResultsPath}\".`,
    'Open exported results'
  );
  if (shouldOpenExportedResults) {
    const summaryFilePath = path.join(exportedResultsPath, '_summary.md');
    const summaryFile = await workspace.openTextDocument(summaryFilePath);
    await window.showTextDocument(summaryFile, ViewColumn.One);
    await commands.executeCommand('revealFileInOS', Uri.file(summaryFilePath));
  }
}
