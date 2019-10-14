import * as path from 'path';
import { runTests } from 'vscode-test';

/**
 * Integration test runner. Launches the VSCode Extension Development Host with this extension installed.
 * See https://github.com/microsoft/vscode-test/blob/master/sample/test/runTest.ts
 */
async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../');

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    // TODO
    const extensionTestsPath = path.resolve(__dirname, './query-test');

    // Download VS Code, unzip it and run the integration test.
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();