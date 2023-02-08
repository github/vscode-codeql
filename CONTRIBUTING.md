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

You can use VS Code to debug the extension without explicitly installing it. Just open this directory as a workspace in VS Code, and hit `F5` to start a debugging session.

### Storybook

You can use [Storybook](https://storybook.js.org/) to preview React components outside VSCode. Inside the `extensions/ql-vscode` directory, run:

```shell
npm run storybook
```

Your browser should automatically open to the Storybook UI. Stories live in the `src/stories` directory.

Alternatively, you can start Storybook inside of VSCode. There is a VSCode launch configuration for starting Storybook. It can be found in the debug view.

More information about Storybook can be found inside the **Overview** page once you have launched Storybook.

### Testing

We have several types of tests:

* Unit tests: these live in the `tests/unit-tests/` directory
* View tests: these live in `src/view/variant-analysis/__tests__/`
* VSCode integration tests:
  * `test/vscode-tests/no-workspace` tests: These are intended to cover functionality that is meant to work before you even have a workspace open. 
  * `test/vscode-tests/minimal-workspace` tests: These are intended to cover functionality that need a workspace but don't require the full extension to be activated.
* CLI integration tests: these live in `test/vscode-tests/cli-integration`
  * These tests are intendended to be cover functionality that is related to the integration between the CodeQL CLI and the extension.

The CLI integration tests require an instance of the CodeQL CLI to run so they will require some extra setup steps. When adding new tests to our test suite, please be mindful of whether they need to be in the cli-integration folder. If the tests don't depend on the CLI, they are better suited to being a VSCode integration test.

Any test data you're using (sample projects, config files, etc.) must go in a `test/vscode-tests/*/data` directory. When you run the tests, the test runner will copy the data directory to `out/vscode-tests/*/data`.

#### Running the tests

Pre-requisites:
1. Run `npm run build`.
2. You will need to have `npm run watch` running in the background.

##### 1. From the terminal

Then, from the `extensions/ql-vscode` directory, use the appropriate command to run the tests:

* Unit tests: `npm run test:unit`
* View Tests: `npm test:view`
* VSCode integration tests: `npm run integration`

###### CLI integration tests

The CLI integration tests require the CodeQL standard libraries in order to run so you will need to clone a local copy of the `github/codeql` repository.

1. Set the `TEST_CODEQL_PATH` environment variable: running from a terminal, you _must_ set the `TEST_CODEQL_PATH` variable to point to a checkout of the `github/codeql` repository. The appropriate CLI version will be downloaded as part of the test.

2. Run your test command:

```shell
cd extensions/ql-vscode && npm run cli-integration
```

##### 2. From VSCode

Alternatively, you can run the tests inside of VSCode. There are several VSCode launch configurations defined that run the unit and integration tests.

You will need to run tests using a task from inside of VS Code, under the "Run and Debug" view:

* Unit tests: run the _Launch Unit Tests - React_ task
* View Tests: run the _Launch Unit Tests_ task
* VSCode integration tests: run the _Launch Unit Tests - No Workspace_ and _Launch Unit Tests - Minimal Workspace_ tasks

###### CLI integration tests

The CLI integration tests require the CodeQL standard libraries in order to run so you will need to clone a local copy of the `github/codeql` repository.

1. Set the `TEST_CODEQL_PATH` environment variable: running from a terminal, you _must_ set the `TEST_CODEQL_PATH` variable to point to a checkout of the `github/codeql` repository. The appropriate CLI version will be downloaded as part of the test.

2. Set the codeql path in VSCode's launch configuration: open `launch.json` and under the _Launch Integration Tests - With CLI_ section, uncomment the `"${workspaceRoot}/../codeql"` line. If you've cloned the `github/codeql` repo to a different path, replace the value with the correct path.

3. Run the VSCode task from the "Run and Debug" view called _Launch Integration Tests - With CLI_.

#### Running a single test

##### 1. From the terminal

The easiest way to run a single test is to change the `it` of the test to `it.only` and then run the test command with some additional options
to only run tests for this specific file. For example, to run the test `test/vscode-tests/cli-integration/run-queries.test.ts`:

```shell
npm run cli-integration -- --runTestsByPath test/vscode-tests/cli-integration/run-queries.test.ts
```

You can also use the `--testNamePattern` option to run a specific test within a file. For example, to run the test `test/vscode-tests/cli-integration/run-queries.test.ts`:

```shell
npm run cli-integration -- --runTestsByPath test/vscode-tests/cli-integration/run-queries.test.ts --testNamePattern "should create a QueryEvaluationInfo"
```

##### 2. From VSCode

Alternatively, you can run a single test inside VSCode. To do so, install the [Jest Runner](https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner) extension. Then,
you will have quicklinks to run a single test from within test files. To run a single unit or integration test, click the "Run" button. Debugging a single test is currently only supported
for unit tests by default. To debug integration tests, open the `.vscode/settings.json` file and uncomment the `jestrunner.debugOptions` lines. This will allow you to debug integration tests.
Please make sure to revert this change before committing; with this setting enabled, it is not possible to debug unit tests.

Without the Jest Runner extension, you can also use the "Launch Selected Unit Test (vscode-codeql)" launch configuration to run a single unit test.

#### Using a mock GitHub API server

Multi-Repo Variant Analyses (MRVA) rely on the GitHub API. In order to make development and testing easy, we have functionality that allows us to intercept requests to the GitHub API and provide mock responses.

##### Using a pre-recorded test scenario

To run a mock MRVA scenario, follow these steps:
1. Enable the mock GitHub API server by adding the following in your VS Code user settings (which can be found by running the `Preferences: Open User Settings (JSON)` VS Code command):
```json
"codeQL.mockGitHubApiServer": {
  "enabled": true
}
```

1. Run the `CodeQL: Mock GitHub API Server: Load Scenario` command from the command pallet, and choose one of the scenarios to load.
1. Execute a normal MRVA. At this point you should see the scenario being played out, rather than an actual MRVA running.
1. Once you're done, you can stop using the mock scenario with `CodeQL: Mock GitHub API Server: Unload Scenario`

If you want to replay the same scenario you should unload and reload it so requests are replayed from the start.

##### Recording a new test scenario
To record a new mock MRVA scenario, follow these steps:

1. Enable the mock GitHub API server by adding the following in your VS Code user settings (which can be found by running the `Preferences: Open User Settings (JSON)` VS Code command):
```json
"codeQL.mockGitHubApiServer": {
  "enabled": true
}
```

1. Run the `CodeQL: Mock GitHub API Server: Start Scenario Recording` VS Code command from the command pallet.
1. Execute a normal MRVA.
1. Once what you wanted to record is done (e.g. the MRVA has finished), then run the `CodeQL: Mock GitHub API Server: Save Scenario` command from the command pallet.
1. The scenario should then be available for replaying.

If you want to cancel recording, run the `CodeQL: Mock GitHub API Server: Cancel Scenario Recording` command.

Once the scenario has been recorded, it's often useful to remove some of the requests to speed up the replay, particularly ones that fetch the variant analysis status. Once some of the request files have manually been removed, the [fix-scenario-file-numbering script](./extensions/ql-vscode/scripts/fix-scenario-file-numbering.ts) can be used to update the number of the files. See the script file for details on how to use.

#### Scenario data location

Pre-recorded scenarios are stored in `./src/mocks/scenarios`. However, it's possible to configure the location, by setting the `codeQL.mockGitHubApiServer.scenariosPath` configuration property in the VS Code user settings.

## Releasing (write access required)

1. Go through [our test plan](/extensions/ql-vscode/docs/test-plan.md) to ensure that the extension is working as expected.
1. Double-check the `CHANGELOG.md` contains all desired change comments and has the version to be released with date at the top.
    * Go through all recent PRs and make sure they are properly accounted for.
    * Make sure all changelog entries have links back to their PR(s) if appropriate.
    * For picking the new version number, we default to increasing the patch version number, but make our own judgement about whether a change is big enough to warrant a minor version bump. Common reasons for a minor bump could include:
      * Making substantial new features available to all users. This can include lifting a feature flag.
      * Breakage in compatibility with recent versions of the CLI.
      * Minimum required version of VS Code is increased.
      * New telemetry events are added.
      * Deprecation or removal of commands.
      * Accumulation of many changes, none of which are individually big enough to warrant a minor bump, but which together are. This does not include changes which are purely internal to the extension, such as refactoring, or which are only available behind a feature flag.
1. Double-check that the node version we're using matches the one used for VS Code. If it doesn't, you will then need to update the node version in the following files:
    * `.nvmrc` - this will enable `nvm` to automatically switch to the correct node version when you're in the project folder
    * `.github/workflows/main.yml` - all the "node-version: <version>" settings
    * `.github/workflows/release.yml` - the "node-version: <version>" setting
1. Double-check that the extension `package.json` and `package-lock.json` have the version you intend to release. If you are doing a patch release (as opposed to minor or major version) this should already be correct.
1. Create a PR for this release:
    * This PR will contain any missing bits from steps 1 and 2. Most of the time, this will just be updating `CHANGELOG.md` with today's date.
    * Create a new branch for the release named after the new version. For example: `v1.3.6`
    * Create a new commit with a message the same as the branch name.
    * Create a PR for this branch.
    * Wait for the PR to be merged into `main`
1. Switch to `main` and add a new tag on the `main` branch with your new version (named after the release), e.g.
    ```bash
    git checkout main
    git tag v1.3.6
    ```

   If you've accidentally created a badly named tag, you can delete it via
    ```bash
    git tag -d badly-named-tag
    ```
1. Push the new tag up:

   a. If you're using a fork of the repo:

    ```bash
    git push upstream refs/tags/v1.3.6
    ```

   b. If you're working straight in this repo:

    ```bash
    git push origin refs/tags/v1.3.6
    ```

   This will trigger [a release build](https://github.com/github/vscode-codeql/releases) on Actions.

    * **IMPORTANT** Make sure you are on the `main` branch and your local checkout is fully updated when you add the tag.
    * If you accidentally add the tag to the wrong ref, you can just force push it to the right one later.
1. Monitor the status of the release build in the `Release` workflow in the Actions tab.
    * DO NOT approve the "publish" stages of the workflow yet.
1. Download the VSIX from the draft GitHub release at the top of [the releases page](https://github.com/github/vscode-codeql/releases) that is created when the release build finishes.
1. Unzip the `.vsix` and inspect its `package.json` to make sure the version is what you expect,
   or look at the source if there's any doubt the right code is being shipped.
1. Install the `.vsix` file into your vscode IDE and ensure the extension can load properly. Run a single command (like run query, or add database).
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

To regenerate the VSCode Marketplace token, please see our internal documentation. Note that Azure DevOps PATs expire every 90 days and must be regenerated.

## Resources

* [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
* [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
* [GitHub Help](https://help.github.com)
