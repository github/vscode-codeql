## Contributing

[fork]: https://github.com/github/vscode-codeql/fork
[pr]: https://github.com/github/vscode-codeql/compare
[style]: https://primer.style
[code-of-conduct]: CODE_OF_CONDUCT.md

Hi there! We're thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

Contributions to this project are [released](https://help.github.com/articles/github-terms-of-service/#6-contributions-under-repository-license) to the public under the [project's open source license](LICENSE.md).

Please note that this project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating in this project you agree to abide by its terms.

## Submitting a pull request

0. [Fork][fork] and clone the repository
0. Set up a local build
0. Create a new branch: `git checkout -b my-branch-name`
0. Make your change
0. Push to your fork and [submit a pull request][pr]
0. Pat yourself on the back and wait for your pull request to be reviewed and merged.

Here are a few things you can do that will increase the likelihood of your pull request being accepted:

- Follow the [style guide][style].
- Write tests. Tests that don't require the VS Code API are located [here](extensions/ql-vscode/test). Integration tests that do require the VS Code API are located [here](extensions/ql-vscode/src/vscode-tests).
- Keep your change as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.
- Write a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

## Setting up a local build

Make sure you have a fairly recent version of vscode (>1.32) and are using nodejs
version >=v10.13.0. (Tested on v10.15.1 and v10.16.0).

This repo uses [Rush](https://rushjs.io) to handle package management, building, and other
operations across multiple projects. See the Rush "[Getting started as a developer](https://rushjs.io/pages/developer/new_developer/)" docs
for more details.

If you plan on building from the command line, it's easiest if Rush is installed globally:

```shell
npm install -g @microsoft/rush
```

Note that when you run the `rush` command from the globally installed version, it will examine the
`rushVersion` property in the repo's `rush.json`, and if it differs from the globally installed
version, it will download, cache, and run the version of Rush specified in the `rushVersion`
property.

If you plan on only building via VS Code tasks, you don't need Rush installed at all, since those
tasks run `common/scripts/install-run-rush.js` to bootstrap a locally installed and cached copy of
Rush.

### Building

#### Installing all packages (instead of `npm install`)

After updating any `package.json` file, or after checking or pulling a new branch, you need to
make sure all the right npm packages are installed, which you would normally do via `npm install` in
a single-project repo. With Rush, you need to do an "update" instead:

##### From VS Code

`Terminal > Run Task... > Update`

##### From the command line

```shell
$ rush update
```

#### Building all projects (instead of `gulp`)

Rush builds all projects in the repo, in dependency order, building multiple projects in parallel
where possible. By default, the build also packages the extension itself into a .vsix file in the
`dist` directory. To build:

##### From VS Code

`Terminal > Run Build Task...` (or just `Ctrl+Shift+B` with the default key bindings)

##### From the command line

```shell
rush build --verbose
```

#### Forcing a clean build

Rush does a reasonable job of detecting on its own which projects need to be rebuilt, but if you need to
force a full rebuild of all projects:

##### From VS Code

`Terminal > Run Task... > Rebuild`

##### From the command line

```shell
rush rebuild --verbose
```

### Installing

You can install the `.vsix` file from within VS Code itself, from the Extensions container in the sidebar:

`More Actions...` (top right) `> Install from VSIX...`

Or, from the command line, use something like (depending on where you have VSCode installed):

```shell
$ code --install-extension dist/vscode-codeql-*.vsix # normal VSCode installation
# or maybe
$ vscode/scripts/code-cli.sh --install-extension dist/vscode-codeql-*.vsix # if you're using the open-source version from a checkout of https://github.com/microsoft/vscode
```

### Debugging

You can use VS Code to debug the extension without explicitly installing it. Just open this directory as a workspace in VS Code, and hit `F5` to start a debugging session.

## Releasing (write access required)

1. Trigger a release build on Actions by adding a new tag on master of the format `vxx.xx.xx`
1. Monitor the status of the release build in the `Release` workflow in the Actions tab.
1. Download the VSIX from the draft GitHub release that is created when the release build finishes.
1. Log into the [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage/publishers/github).
1. Click the `...` menu in the CodeQL row and click **Update**.
1. Drag the `.vsix` file you downloaded from the GitHub release into the Marketplace and click **Upload**.
1. Publish the GitHub release.

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
