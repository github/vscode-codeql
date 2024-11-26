# Contributing

[fork]: https://github.com/github/vscode-codeql/fork
[pr]: https://github.com/github/vscode-codeql/compare
[style]: https://github.com/microsoft/vscode-webview-ui-toolkit
[code-of-conduct]: CODE_OF_CONDUCT.md

Hi there! We're thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

Contributions to this project are [released](https://help.github.com/articles/github-terms-of-service/#6-contributions-under-repository-license) to the public under the [project's open source license](LICENSE.md).

Please note that this project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating in this project you agree to abide by its terms.

## Submitting a pull request

1. [Fork][fork] and clone the repository
1. Set up a local build
1. Create a new branch: `git checkout -b my-branch-name`
1. Make your change
1. Push to your fork and [submit a pull request][pr]
1. Pat yourself on the back and wait for your pull request to be reviewed and merged.

Here are a few things you can do that will increase the likelihood of your pull request being accepted:

- Follow the [style guide][style].
- Write tests:
  - [Tests that don't require the VS Code API are located here](extensions/ql-vscode/test).
  - [Integration tests that do require the VS Code API are located here](extensions/ql-vscode/src/vscode-tests).
- Keep your change as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.
- Write a [good commit message](https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).
- Update the [changelog](https://github.com/github/vscode-codeql/blob/main/extensions/ql-vscode/CHANGELOG.md) if you are making user-facing changes.

## Setting up a local build

Make sure you have installed recent versions of vscode, node, and npm. Check the `engines` block in [`package.json`](https://github.com/github/vscode-codeql/blob/main/extensions/ql-vscode/package.json) file for compatible versions. Earlier versions may work, but we no longer test against them.

To automatically switch to the correct version of node, we recommend using [nvm](https://github.com/nvm-sh/nvm), which will pick-up the node version from `.nvmrc`.

### Installing all packages

From the command line, go to the directory `extensions/ql-vscode` and run

```shell
npm install
```

### Building the extension

From the command line, go to the directory `extensions/ql-vscode` and run

```shell
npm run build
npm run watch
```

Alternatively, you can build the extension within VS Code via `Terminal > Run Build Task...` (or `Ctrl+Shift+B` with the default key bindings). And you can run the watch command via `Terminal > Run Task` and then select `npm watch` from the menu.

Before running any of the launch commands, be sure to have run the `build` command to ensure that the JavaScript is compiled and the resources are copied to the proper location.

We recommend that you keep `npm run watch` running in the background and you only need to re-run `npm run build` in the following situations:

1. on first checkout
2. whenever any of the non-TypeScript resources have changed

### Installing the extension

You can install the `.vsix` file from within VS Code itself, from the Extensions container in the sidebar:

`More Actions...` (top right) `> Install from VSIX...`

Or, from the command line, use something like (depending on where you have VSCode installed):

```shell
$ code --install-extension dist/vscode-codeql-*.vsix # normal VSCode installation
# or maybe
$ vscode/scripts/code-cli.sh --install-extension dist/vscode-codeql-*.vsix # if you're using the open-source version from a checkout of https://github.com/microsoft/vscode
```

### Debugging

You can use VS Code to debug the extension without explicitly installing it. Just open this repository's root directory as a workspace in VS Code, and hit `F5` to start a debugging session.

### Storybook

You can use [Storybook](https://storybook.js.org/) to preview React components outside VSCode. Inside the `extensions/ql-vscode` directory, run:

```shell
npm run storybook
```

Your browser should automatically open to the Storybook UI. Stories live in the `src/stories` directory.

Alternatively, you can start Storybook inside of VSCode. There is a VSCode launch configuration for starting Storybook. It can be found in the debug view.

More information about Storybook can be found inside the **Overview** page once you have launched Storybook.

### Testing

[Information about testing can be found here](./docs/testing.md).

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
