// This generates protobuf javascript code in gen. It requires the
// google protobuf compiler protoc be installed, and that the
// SEMMLE_CODE environment variable is set to the root of a Semmle/code
// checkout.
import { ChildProcess } from 'child_process';
import * as cpp from 'child-process-promise';
import * as fs from 'fs';
import * as glob from 'glob-promise';
import * as os from 'os';
import * as path from 'path';

export async function buildProtocols(): Promise<void> {
  let codeRoot = process.env.SEMMLE_CODE;
  if (!codeRoot) {
    codeRoot = 'code';
  }
  
  const protoDir = path.join(codeRoot, 'queryserver-client', 'proto');
  const protoFiles = await glob(path.join(protoDir, '*.proto'));

  let protocPath: string;
  let tsPluginSuffix: string;

  switch (os.platform()) {
    case 'win32':
      protocPath = 'windows/compiler/protoc.exe';
      tsPluginSuffix = '.cmd';
      break;

    case 'linux':
      protocPath = 'linux/compiler/protoc';
      tsPluginSuffix = '';
      break;

    case 'darwin':
      protocPath = 'osx/compiler/protoc';
      tsPluginSuffix = '';
      break;

    default:
      throw new Error(`Unsupported os.platform() '${os.platform()}'.`);
  }

  protocPath = path.join(codeRoot, 'resources/lib/protoc', protocPath);
  const tsPlugin = path.join('node_modules/.bin/protoc-gen-ts') + tsPluginSuffix;

  await fs.promises.mkdir('gen', { recursive: true });

  const p = cpp.spawn(protocPath, [
    `--plugin=protoc-gen-ts=${tsPlugin}`,
    '--js_out=import_style=commonjs,binary:gen',
    '--ts_out=gen',
    `--proto_path=${codeRoot}/queryserver-client/proto/`,
    ...protoFiles
  ]);
  const proc: ChildProcess = p['childProcess']!;
  proc.stdout!.pipe(process.stdout);
  proc.stderr!.pipe(process.stderr);

  await p;
}
