import * as path from 'path';
import * as os from 'os';
import * as cp from 'child_process';
import {
  runTests,
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath
} from 'vscode-test';
import { assertNever } from '../pure/helpers-pure';

// For some reason, `TestOptions` is not exported directly from `vscode-test`,
// but we can be tricky and import directly from the out file.
import { TestOptions } from 'vscode-test/out/runTest';


// Which version of vscode to test against. Can set to 'stable' or
// 'insiders' or an explicit version number. See runTest.d.ts in
// vscode-test for more details.

// For CI purposes we want to leave this at 'stable' to catch any bugs
// that might show up with new vscode versions released, even though
// this makes testing not-quite-pure, but it can be changed for local
// testing against old versions if necessary.
const VSCODE_VERSION = 'stable';

// List if test dirs
//   - no-workspace - Tests with no workspace selected upon launch.
//   - minimal-workspace - Tests with a simple workspace selected upon launch.
//   - cli-integration - Tests that require a cli to invoke actual commands
enum TestDir {
  NoWorksspace = 'no-workspace',
  MinimalWorksspace = 'minimal-workspace',
  CliIntegration = 'cli-integration'
}

/**
 * Run an integration test suite `suite`, retrying if it segfaults, at
 * most `tries` times.
 */
async function runTestsWithRetryOnSegfault(suite: TestOptions, tries: number): Promise<void> {
  for (let t = 0; t < tries; t++) {
    try {
      // Download and unzip VS Code if necessary, and run the integration test suite.
      await runTests(suite);
      return;
    } catch (err) {
      if (err === 'SIGSEGV') {
        console.error('Test runner segfaulted.');
        if (t < tries - 1)
          console.error('Retrying...');
      }
      else if (os.platform() === 'win32') {
        console.error(`Test runner caught exception (${err})`);
        if (t < tries - 1)
          console.error('Retrying...');
      }
      else {
        throw err;
      }
    }
  }
  console.error(`Tried running suite ${tries} time(s), still failed, giving up.`);
  process.exit(1);
}

/**
 * Integration test runner. Launches the VSCode Extension Development Host with this extension installed.
 * See https://github.com/microsoft/vscode-test/blob/master/sample/test/runTest.ts
 */
async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../..');
    const vscodeExecutablePath = await downloadAndUnzipVSCode(VSCODE_VERSION);


    // Which tests to run. Use a comma-separated list of directories.
    const testDirsString = process.argv[2];
    const dirs = testDirsString.split(',').map(dir => dir.trim().toLocaleLowerCase());

    if (dirs.includes(TestDir.CliIntegration)) {
      console.log('Installing required extensions');
      const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);
      cp.spawnSync(cliPath, ['--install-extension', 'hbenl.vscode-test-explorer'], {
        encoding: 'utf-8',
        stdio: 'inherit'
      });
    }

    console.log(`Running integration tests in these directories: ${dirs}`);
    for (const dir of dirs) {
      const launchArgs = getLaunchArgs(dir as TestDir);
      console.log(`Next integration test dir: ${dir}`);
      console.log(`Launch args: ${launchArgs}`);
      await runTestsWithRetryOnSegfault({
        version: VSCODE_VERSION,
        vscodeExecutablePath,
        extensionDevelopmentPath,
        extensionTestsPath: path.resolve(__dirname, dir, 'index'),
        launchArgs
      }, 3);
    }
  } catch (err) {
    console.error(`Unexpected exception while running tests: ${err}`);
    process.exit(1);
  }
}

void main();


function getLaunchArgs(dir: TestDir) {
  switch (dir) {
    case TestDir.NoWorksspace:
      return [
        '--disable-extensions',
        '--disable-gpu'
      ];

    case TestDir.MinimalWorksspace:
      return [
        '--disable-extensions',
        '--disable-gpu',
        path.resolve(__dirname, '../../test/data')
      ];

    case TestDir.CliIntegration:
      // CLI integration tests requires a multi-root workspace so that the data and the QL sources are accessible.
      return [
        '--disable-gpu',
        path.resolve(__dirname, '../../test/data'),

        // explicitly disable extensions that are known to interfere with the CLI integration tests
        '--disable-extension',
        'eamodio.gitlens',
        '--disable-extension',
        'github.codespaces',
        '--disable-extension',
        'github.copilot',
        process.env.TEST_CODEQL_PATH!
      ];

    default:
      assertNever(dir);
  }
  return undefined;
}
