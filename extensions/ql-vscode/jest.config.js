/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  projects: [
    "<rootDir>/src/view",
    "<rootDir>/test/unit-tests",
    "<rootDir>/test/vscode-tests/cli-integration",
    "<rootDir>/test/vscode-tests/no-workspace",
    "<rootDir>/test/vscode-tests/minimal-workspace",
  ],
};
