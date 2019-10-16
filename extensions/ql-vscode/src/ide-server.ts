import * as cp from 'child_process';
import * as path from 'path';
import { StreamInfo } from 'vscode-languageclient';
import { QLConfiguration } from './config';
import { ideServerLogger } from './logging';

/**
 * ide-server.ts
 * -------------
 *
 * Managing the lsp server for QL.
 */

export async function spawnIdeServer(config: QLConfiguration): Promise<StreamInfo> {
  const command = config.codeQlPath;
  const args = ['execute', 'language-server', '--check-errors', 'ON_CHANGE']
  const argsString = args.join(" ");
  const options: cp.SpawnOptions = {};
  ideServerLogger.log(`Starting QL language server using CodeQL CLI: ${command} ${argsString}`);
  const child = cp.spawn(command, args, options);
  if (!child || !child.pid) {
    throw new Error(`Launching server using command ${command} ${argsString} failed.`);
  }
  child.stderr!.on('data', data => ideServerLogger.logWithoutTrailingNewline(data.toString()));
  child.stdout!.on('data', data => ideServerLogger.logWithoutTrailingNewline(data.toString()));
  ideServerLogger.log(`QL language server started on PID: ${child.pid}`);
  return { writer: child.stdin!, reader: child.stdout! };
}
