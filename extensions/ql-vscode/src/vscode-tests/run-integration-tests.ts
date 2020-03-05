import * as path from 'path';
import { runTests } from 'vscode-test';

// A subset of the fields in TestOptions from vscode-test, which we
// would simply use instead, but for the fact that it doesn't export
// it.
type Suite = {
  extensionDevelopmentPath: string,
  extensionTestsPath: string,
  launchArgs: string[]
};

/**
 * Run an integration test suite `suite` at most `tries` times, or
 * until it succeeds, whichever comes first.
 *
 * TODO: Presently there is no way to distinguish a legitimately
 * failed test run from the test runner being terminated by a signal.
 * If in the future there arises a way to distinguish these cases
 * (e.g. https://github.com/microsoft/vscode-test/pull/56) only retry
 * in the terminated-by-signal case.
 */
async function runTestsWithRetry(suite: Suite, tries: number): Promise<void> {
  for (let t = 0; t < tries; t++) {
    try {
      // Download and unzip VS Code if necessary, and run the integration test suite.
      await runTests(suite);
      return;
    } catch (err) {
      console.error(`Exception raised while running tests: ${err}`);
      if (t < tries - 1)
        console.error('Retrying...');
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
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`.
    const extensionDevelopmentPath = path.resolve(__dirname, '../..');

    // List of integration test suites.
    // The path to the extension test runner script is passed to --extensionTestsPath.
    const integrationTestSuites = [
      // Tests with no workspace selected upon launch.
      {
        extensionDevelopmentPath: extensionDevelopmentPath,
        extensionTestsPath: path.resolve(__dirname, 'no-workspace', 'index'),
        launchArgs: ['--disable-extensions'],
      },
      // Tests with a simple workspace selected upon launch.
      {
        extensionDevelopmentPath: extensionDevelopmentPath,
        extensionTestsPath: path.resolve(__dirname, 'minimal-workspace', 'index'),
        launchArgs: [
          path.resolve(__dirname, '../../test/data'),
          '--disable-extensions',
        ]
      }
    ];

    for (const integrationTestSuite of integrationTestSuites) {
      await runTestsWithRetry(integrationTestSuite, 2);
    }
  } catch (err) {
    console.error('Unexpected exception while running tests');
    process.exit(1);
  }
}

main();
