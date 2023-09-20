# Node version

The CodeQL for VS Code extension defines the version of Node.js that it is intended to run with. This Node.js version is used when running most CI and unit tests.

When running in production (i.e. as an extension for a VS Code application) it will use the Node.js version provided by VS Code. This can mean a different Node.js version is used by different users with different versions of VS Code.
We should make sure the CodeQL for VS Code extension works with the Node.js version supplied by all versions of VS Code that we support.

## Checking the version of Node.js supplied by VS Code

You can find this info by seleting "About Visual Studio Code" from the top menu.

![about-vscode](images/about-vscodeaba.png)

## Updating the Node.js version

The following files will need to be updated:
- `.github/workflows/cli-test.yml` - the "node-version: '[VERSION]'" setting
- `.github/workflows/main.yml` - all the "node-version: '[VERSION]'" settings
- `.github/workflows/release.yml` - the "node-version: '[VERSION]'" setting
- `extensions/ql-vscode/.nvmrc` - this will enable nvm to automatically switch to the correct node version when you're in the project folder
- `extensions/ql-vscode/package-lock.json` - the "engines.node: '[VERSION]'" setting
- `extensions/ql-vscode/package.json` - the "engines.node: '[VERSION]'" setting
