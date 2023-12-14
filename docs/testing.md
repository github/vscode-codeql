# Testing

We have several types of tests:

- Unit tests: these live in the `tests/unit-tests/` directory
- View tests: these live in `src/view/variant-analysis/__tests__/`
- VSCode integration tests:
  - `test/vscode-tests/activated-extension` tests: These are intended to cover functionality that require the full extension to be activated but don't require the CLI. This suite is not run against multiple versions of the CLI in CI.
  - `test/vscode-tests/no-workspace` tests: These are intended to cover functionality around not having a workspace. The extension is not activated in these tests.
  - `test/vscode-tests/minimal-workspace` tests: These are intended to cover functionality that need a workspace but don't require the full extension to be activated.
- CLI integration tests: these live in `test/vscode-tests/cli-integration`
  - These tests are intended to cover functionality that is related to the integration between the CodeQL CLI and the extension. These tests are run against each supported versions of the CLI in CI.

The CLI integration tests require an instance of the CodeQL CLI to run so they will require some extra setup steps. When adding new tests to our test suite, please be mindful of whether they need to be in the cli-integration folder. If the tests don't depend on the CLI, they are better suited to being a VSCode integration test.

Any test data you're using (sample projects, config files, etc.) must go in a `test/vscode-tests/*/data` directory. When you run the tests, the test runner will copy the data directory to `out/vscode-tests/*/data`.

## Running the tests

Pre-requisites:

1. Run `npm run build`.
2. You will need to have `npm run watch` running in the background.

### 1. From the terminal

Then, from the `extensions/ql-vscode` directory, use the appropriate command to run the tests:

- Unit tests: `npm run test:unit`
- View Tests: `npm run test:view`
- VSCode integration tests: `npm run test:vscode-integration`

#### Running CLI integration tests from the terminal

The CLI integration tests require the CodeQL standard libraries in order to run so you will need to clone a local copy of the `github/codeql` repository.

1. Set the `TEST_CODEQL_PATH` environment variable: running from a terminal, you _must_ set the `TEST_CODEQL_PATH` variable to point to a checkout of the `github/codeql` repository. The appropriate CLI version will be downloaded as part of the test.

2. Run your test command:

```shell
cd extensions/ql-vscode && npm run test:cli-integration
```

### 2. From VSCode

Alternatively, you can run the tests inside of VSCode. There are several VSCode launch configurations defined that run the unit and integration tests.

You will need to run tests using a task from inside of VS Code, under the "Run and Debug" view:

- Unit tests: run the _Launch Unit Tests_ task
- View Tests: run the _Launch Unit Tests - React_ task
- VSCode integration tests: run the _Launch Unit Tests - No Workspace_ and _Launch Unit Tests - Minimal Workspace_ tasks

#### Running CLI integration tests from VSCode

The CLI integration tests require the CodeQL standard libraries in order to run so you will need to clone a local copy of the `github/codeql` repository.

1. Set the `TEST_CODEQL_PATH` environment variable: running from a terminal, you _must_ set the `TEST_CODEQL_PATH` variable to point to a checkout of the `github/codeql` repository. The appropriate CLI version will be downloaded as part of the test.

2. Set the codeql path in VSCode's launch configuration: open `launch.json` and under the _Launch Integration Tests - With CLI_ section, uncomment the `"${workspaceRoot}/../codeql"` line. If you've cloned the `github/codeql` repo to a different path, replace the value with the correct path.

3. Run the VSCode task from the "Run and Debug" view called _Launch Integration Tests - With CLI_.

## Running a single test

### 1. Running a single test from the terminal

The easiest way to run a single test is to change the `it` of the test to `it.only` and then run the test command with some additional options
to only run tests for this specific file. For example, to run the test `test/vscode-tests/cli-integration/run-queries.test.ts`:

```shell
npm run test:cli-integration -- --runTestsByPath test/vscode-tests/cli-integration/run-queries.test.ts
```

You can also use the `--testNamePattern` option to run a specific test within a file. For example, to run the test `test/vscode-tests/cli-integration/run-queries.test.ts`:

```shell
npm run test:cli-integration -- --runTestsByPath test/vscode-tests/cli-integration/run-queries.test.ts --testNamePattern "should create a QueryEvaluationInfo"
```

### 2. Running a single test from VSCode

Alternatively, you can run a single test inside VSCode. To do so, install the [Jest Runner](https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner) extension. Then,
you will have quicklinks to run a single test from within test files. To run a single unit or integration test, click the "Run" button. Debugging a single test is currently only supported
for unit tests by default. To debug integration tests, open the `.vscode/settings.json` file and uncomment the `jestrunner.debugOptions` lines. This will allow you to debug integration tests.
Please make sure to revert this change before committing; with this setting enabled, it is not possible to debug unit tests.

Without the Jest Runner extension, you can also use the "Launch Selected Unit Test (vscode-codeql)" launch configuration to run a single unit test.

## Using a mock GitHub API server

Multi-Repo Variant Analyses (MRVA) rely on the GitHub API. In order to make development and testing easy, we have functionality that allows us to intercept requests to the GitHub API and provide mock responses.

### Using a pre-recorded test scenario

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

### Recording a new test scenario

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

Once the scenario has been recorded, it's often useful to remove some of the requests to speed up the replay, particularly ones that fetch the variant analysis status. Once some of the request files have manually been removed, the [fix-scenario-file-numbering script](../extensions/ql-vscode/scripts/fix-scenario-file-numbering.ts) can be used to update the number of the files. See the script file for details on how to use.

### Scenario data location

Pre-recorded scenarios are stored in `./src/common/mock-gh-api/scenarios`. However, it's possible to configure the location, by setting the `codeQL.mockGitHubApiServer.scenariosPath` configuration property in the VS Code user settings.
