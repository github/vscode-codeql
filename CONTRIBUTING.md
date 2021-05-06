# Contributing

[fork]: https://github.com/github/vscode-codeql/fork
[pr]: https://github.com/github/vscode-codeql/compare
[style]: https://primer.style
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

* Follow the [style guide][style].
* Write tests. Tests that don't require the VS Code API are located [here](extensions/ql-vscode/test). Integration tests that do require the VS Code API are located [here](extensions/ql-vscode/src/vscode-tests).
* Keep your change as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.
* Write a [good commit message](https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

## Setting up a local build

Make sure you have installed recent versions of vscode (>= v1.52), node (>=12.16), and npm (>= 7.5.2). Earlier versions will probably work, but we no longer test against them.

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

We recommend that you keep `npm run watch` running in the backgound and you only need to re-run `npm run build` in the following situations:

1. on first checkout
2. whenever any of the non-TypeScript resources have changed
3. on any change to files included in one of the webviews
   - **Important**: This is easy to forget. You must explicitly run `npm run build` whenever one of the files in the webview is changed. These are the files in the `src/view` and `src/compare/view` folders.

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

You can use VS Code to debug the extension without explicitly installing it. Just open this directory as a workspace in VS Code, and hit `F5` to start a debugging session.

### Running the unit/integration tests

Ensure the `CODEQL_PATH` environment variable is set to point to the `codeql` cli executable.

Outside of vscode, run:

```shell
npm run test && npm run integration
```

Alternatively, you can run the tests inside of vscode. There are several vscode launch configurations defined that run the unit and integration tests. They can all be found in the debug view.

## Releasing (write access required)

1. Double-check the `CHANGELOG.md` contains all desired change comments and has the version to be released with date at the top.
    * Go through all recent PRs and make sure they are properly accounted for.
    * Make sure all changelog entries have links back to their PR(s) if appropriate.
1. Double-check that the extension `package.json` and `package-lock.json` have the version you intend to release. If you are doing a patch release (as opposed to minor or major version) this should already be correct.
1. Create a PR for this release:
    * This PR will contain any missing bits from steps 1 and 2. Most of the time, this will just be updating `CHANGELOG.md` with today's date.
    * Create a new branch for the release named after the new version. For example: `v1.3.6`
    * Create a new commit with a message the same as the branch name.
    * Create a PR for this branch.
    * Wait for the PR to be merged into `main`
1. Trigger a release build on Actions by adding a new tag on branch `main` named after the release, as above. Note that when you push to upstream, you will need to fully qualify the ref. A command like this will work:

    ```bash
    git push upstream refs/tags/v1.3.6
    ```

    * **IMPORTANT** Make sure you are on the `main` branch and your local checkout is fully updated when you add the tag.
    * If you accidentally add the tag to the wrong ref, you can just force push it to the right one later.

1. Monitor the status of the release build in the `Release` workflow in the Actions tab.
1. Download the VSIX from the draft GitHub release at the top of [the releases page](https://github.com/github/vscode-codeql/releases) that is created when the release build finishes.
1. Unzip the `.vsix` and inspect its `package.json` to make sure the version is what you expect,
   or look at the source if there's any doubt the right code is being shipped.
1. Go to the actions tab of the vscode-codeql repository and select the [Release workflow](https://github.com/github/vscode-codeql/actions?query=workflow%3ARelease).
    - If there is an authentication failure when publishing, be sure to check that the authentication keys haven't expired. See below.
1. Approve the deployments of the correct Release workflow. This will automatically publish to Open VSX and VS Code Marketplace.
1. Go to the draft GitHub release in [the releases tab of the repository](https://github.com/github/vscode-codeql/releases), click 'Edit', add some summary description, and publish it.
1. Confirm the new release is marked as the latest release at <https://github.com/github/vscode-codeql/releases>.
1. If documentation changes need to be published, notify documentation team that release has been made.
1. Review and merge the version bump PR that is automatically created by Actions.

## Secrets and authentication for publishing

Repository administrators, will need to manage the authentication keys for publishing to the VS Code marketplace and Open VSX. Each requires an authentication token. The VS Code marketplace token expires yearly.

To regenerate the Open VSX token:

1. Log in to the [user settings page on Open VSX](https://open-vsx.org/user-settings/namespaces).
1. Make sure you are a member of the GitHub namespace.
1. Go to the [Access Tokens](https://open-vsx.org/user-settings/tokens) page and generate a new token.
1. Update the secret in the `publish-open-vsx` environment in the project settings.

To regenerate the VSCode Marketplace token:

1. Follow the instructions on [getting a PAT for Azure DevOps](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token).
1. Update the secret in the `publish-vscode-marketplace` environment in the project settings.

Not that Azure DevOps PATs expire yearly and must be regenerated.

## Resources

* [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
* [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
* [GitHub Help](https://help.github.com)
