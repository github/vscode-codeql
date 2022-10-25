import * as path from 'path';

/** @type {import('jest-runner-vscode').RunnerOptions} */
export default {
  workspaceDir: path.resolve(__dirname, '../../../test/data'),
  openInFolder: true,
};
