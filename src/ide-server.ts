import * as cp from 'child_process';
import * as path from 'path';
import { window as Window, workspace as Workspace } from 'vscode';
import { StreamInfo } from 'vscode-languageclient';

/**
 * ide-server.ts
 * -------------
 *
 * Managing the lsp server for QL.
 */

export async function spawnIdeServer(): Promise<StreamInfo> {
  const semmleDist: string = Workspace.getConfiguration('ql').get('distributionPath') as string;
  const command = path.resolve(semmleDist, "tools/java/bin/java");
  const jvmargs = ["-jar", path.resolve(semmleDist, "tools/ideserver.jar")];
  const otherArgs = ["--check-errors", "on_change"]
  const args = jvmargs.concat(otherArgs)
  const options: cp.SpawnOptions = {};
  const child = cp.spawn(command, args, options);

  // Create an output for log messages
  const outputChannel = Window.createOutputChannel('QL Ideserver Debug');
  outputChannel.append("starting language server\n");
  if (!child || !child.pid) {
    throw new Error(`Launching server using command ${command} failed.`);
  }
  child.stderr.on('data', data => outputChannel.append(data.toString()));
  child.stdout.on('data', data => outputChannel.append(data.toString()));
  outputChannel.append("langauge server started on pid:" + child.pid + "\n");
  return { writer: child.stdin, reader: child.stdout };
}
