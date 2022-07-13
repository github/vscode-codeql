import 'source-map-support/register';
import 'vscode-test';

import { runTestsInDirectory } from '../index-template';

export function run(): Promise<void> {
  return runTestsInDirectory(__dirname);
}
