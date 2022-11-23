/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  projects: [
    "<rootDir>/src/view",
    "<rootDir>/test",
    "<rootDir>/out/vscode-tests/cli-integration",
    "<rootDir>/out/vscode-tests/no-workspace",
  ],
};
