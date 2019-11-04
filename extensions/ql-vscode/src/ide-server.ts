import { ProgressLocation, window } from 'vscode';
import { StreamInfo } from 'vscode-languageclient';
import * as cli from './cli';
import { QueryServerConfig } from './config';
import { ideServerLogger } from './logging';

/**
 * Managing the language server for CodeQL.
 */

/** Starts a new CodeQL language server process, sending progress messages to the status bar. */
export async function spawnIdeServer(config: QueryServerConfig): Promise<StreamInfo> {
  return window.withProgress({ title: 'CodeQL language server', location: ProgressLocation.Window }, async (progressReporter, _) => {
    const child = cli.spawnServer(
      config.codeQlPath,
      'CodeQL language server',
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
