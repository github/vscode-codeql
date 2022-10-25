const path = require('path');
const tmp = require('tmp-promise');

const tmpDir = tmp.dirSync({ unsafeCleanup: true });

/** @type {import('jest-runner-vscode').RunnerOptions} */
module.exports = {
  version: 'stable',
  launchArgs: ['--disable-extensions', '--disable-gpu', '--new-window', '--user-data-dir=' + path.join(tmpDir.name, 'user-data')],
  extensionDevelopmentPath: path.resolve(__dirname),
};
