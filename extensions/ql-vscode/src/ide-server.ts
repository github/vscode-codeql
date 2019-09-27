import * as cp from 'child_process';
import * as path from 'path';
import { window as Window, workspace } from 'vscode';
import { StreamInfo } from 'vscode-languageclient';
import { QLConfiguration } from './config';
import { Logger } from './logging';

/**
 * ide-server.ts
 * -------------
 *
 * Managing the lsp server for QL.
 */

export async function spawnIdeServer(config: QLConfiguration, ideServerLogger: Logger): Promise<StreamInfo> {
  const semmleDist = config.qlDistributionPath;
  if (!semmleDist) {
    throw new Error('Semmle distribution path not set.');
  }
  const command = config.javaCommand!;
  const jvmargs = ["-jar", path.resolve(semmleDist, "tools/ideserver.jar")];
  const otherArgs = ["--check-errors", "on_change"]
  const args = jvmargs.concat(otherArgs)
  const options: cp.SpawnOptions = {};
  const child = cp.spawn(command, args, options);

  ideServerLogger.log("Starting QL language server");
  if (!child || !child.pid) {
    throw new Error(`Launching server using command ${command} failed.`);
  }
  child.stderr!.on('data', data => ideServerLogger.append(data.toString()));
  child.stdout!.on('data', data => ideServerLogger.append(data.toString()));
  ideServerLogger.log(`QL language server started on pid: ${child.pid}`);
  return { writer: child.stdin!, reader: child.stdout! };
}
