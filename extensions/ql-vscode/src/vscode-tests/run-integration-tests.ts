import * as path from 'path';
import { runTests } from 'vscode-test';

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
      // Download and unzip VS Code if necessary, and run the integration test suite.
      await runTests(integrationTestSuite);
    }
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
