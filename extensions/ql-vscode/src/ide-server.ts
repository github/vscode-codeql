import { StreamInfo } from 'vscode-languageclient';
import * as cli from './cli';
import { QLConfiguration } from './config';
import { ideServerLogger } from './logging';

/**
 * ide-server.ts
 * -------------
 *
 * Managing the lsp server for QL.
 */

export async function spawnIdeServer(config: QLConfiguration): Promise<StreamInfo> {
  const child = await cli.spawnServer(
    config,
    'QL language server',
    ['execute', 'language-server'],
    ['--check-errors', 'ON_CHANGE'],
    ideServerLogger,
    data => ideServerLogger.logWithoutTrailingNewline(data.toString()),
    data => ideServerLogger.logWithoutTrailingNewline(data.toString())
  );
  return { writer: child.stdin!, reader: child.stdout! };
}
