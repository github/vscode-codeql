/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  projects: [
    "<rootDir>/src/view",
    "<rootDir>/test",
    "<rootDir>/src/vscode-tests/cli-integration",
    "<rootDir>/src/vscode-tests/no-workspace",
    "<rootDir>/src/vscode-tests/minimal-workspace",
  ],
};
