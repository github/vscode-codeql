# Node version

The CodeQL for VS Code extension defines the version of Node.js that it is intended to run with. This Node.js version is used when running most CI and unit tests.

When running in production (i.e. as an extension for a VS Code application) it will use the Node.js version provided by VS Code. This can mean a different Node.js version is used by different users with different versions of VS Code.
We should make sure the CodeQL for VS Code extension works with the Node.js version supplied by all versions of VS Code that we support.

## Checking the version of Node.js supplied by VS Code

You can find this info by seleting "About Visual Studio Code" from the top menu.

![about-vscode](images/about-vscode.png)

## Updating the Node.js version

The following files will need to be updated:

- `extensions/ql-vscode/.nvmrc` - this will enable nvm to automatically switch to the correct Node
   version when you're in the project folder. It will also change the Node version the GitHub Actions
   workflows use.
- `extensions/ql-vscode/package.json` - the "engines.node: '[VERSION]'" setting
- `extensions/ql-vscode/package.json` - the "@types/node: '[VERSION]'" dependency

Then run `npm install` to update the `extensions/ql-vscode/package-lock.json` file.

## Node.js version used in tests

Unit tests will use whatever version of Node.js is installed locally. In CI this will be the version specified in the workflow.

Integration tests download a copy of VS Code and then will use whatever version of Node.js is provided by VS Code. Our integration tests are currently pinned to an older version of VS Code. See [VS Code version used in tests](./vscode-version.md#vs-code-version-used-in-tests) for more information.
