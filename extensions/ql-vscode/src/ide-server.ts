import { ProgressLocation, window } from 'vscode';
import { StreamInfo } from 'vscode-languageclient';
import * as cli from './cli';
import { QueryServerConfig } from './config';
import { ideServerLogger } from './logging';

/**
 * ide-server.ts
 * -------------
 *
 * Managing the lsp server for QL.
 */

/** Starts a new QL language server process, sending progress messages to the status bar. */
export async function spawnIdeServer(config: QueryServerConfig): Promise<StreamInfo> {
  return window.withProgress({ title: 'QL language server', location: ProgressLocation.Window }, async (progressReporter, _) => {
    const child = await cli.spawnServer(
      config,
      'QL language server',
      ['execute', 'language-server'],
      ['--check-errors', 'ON_CHANGE'],
      ideServerLogger,
      data => ideServerLogger.logWithoutTrailingNewline(data.toString()),
      data => ideServerLogger.logWithoutTrailingNewline(data.toString()),
      progressReporter
    );
    return { writer: child.stdin!, reader: child.stdout! };
  });
}
