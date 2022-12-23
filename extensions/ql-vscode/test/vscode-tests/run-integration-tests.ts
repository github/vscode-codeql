import { resolve, join } from "path";
import { platform } from "os";
import { spawnSync } from "child_process";
import {
  runTests,
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} from "@vscode/test-electron";
import { assertNever } from "../../src/pure/helpers-pure";
import { dirSync } from "tmp-promise";

// For some reason, the following are not exported directly from `vscode-test`,
// but we can be tricky and import directly from the out file.
import { TestOptions } from "@vscode/test-electron/out/runTest";

// For CI purposes we want to leave this at 'stable' to catch any bugs
// that might show up with new vscode versions released, even though
// this makes testing not-quite-pure, but it can be changed for local
// testing against old versions if necessary.
const VSCODE_VERSION = "stable";

// List if test dirs
//   - no-workspace - Tests with no workspace selected upon launch.
//   - minimal-workspace - Tests with a simple workspace selected upon launch.
//   - cli-integration - Tests that require a cli to invoke actual commands
enum TestDir {
  NoWorksspace = "no-workspace",
  MinimalWorksspace = "minimal-workspace",
  CliIntegration = "cli-integration",
}

/**
 * Run an integration test suite `suite`, retrying if it segfaults, at
 * most `tries` times.
 */
async function runTestsWithRetryOnSegfault(
  suite: TestOptions,
  tries: number,
): Promise<number> {
  for (let t = 0; t < tries; t++) {
    try {
      // Download and unzip VS Code if necessary, and run the integration test suite.
      return await runTests(suite);
    } catch (err) {
      if (err === "SIGSEGV") {
        console.error("Test runner segfaulted.");
        if (t < tries - 1) console.error("Retrying...");
      } else if (platform() === "win32") {
        console.error(`Test runner caught exception (${err})`);
        if (t < tries - 1) console.error("Retrying...");
      } else {
        throw err;
      }
    }
  }
  console.error(
    `Tried running suite ${tries} time(s), still failed, giving up.`,
  );
  process.exit(1);
}

const tmpDir = dirSync({ unsafeCleanup: true });

/**
 * Integration test runner. Launches the VSCode Extension Development Host with this extension installed.
 * See https://github.com/microsoft/vscode-test/blob/master/sample/test/runTest.ts
 */
async function main() {
  let exitCode = 0;
  try {
    const extensionDevelopmentPath = resolve(__dirname, "../..");
    const vscodeExecutablePath = await downloadAndUnzipVSCode(VSCODE_VERSION);

    // Which tests to run. Use a comma-separated list of directories.
    const testDirsString = process.argv[2];
    const dirs = testDirsString
      .split(",")
      .map((dir) => dir.trim().toLocaleLowerCase());
    const extensionTestsEnv: Record<string, string> = {};
    if (dirs.includes(TestDir.CliIntegration)) {
      console.log("Installing required extensions");
      const [cli, ...args] =
        resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
      spawnSync(
        cli,
        [
          ...args,
          "--install-extension",
          "hbenl.vscode-test-explorer",
          "--install-extension",
          "ms-vscode.test-adapter-converter",
        ],
        {
          encoding: "utf-8",
          stdio: "inherit",
        },
      );
      extensionTestsEnv.INTEGRATION_TEST_MODE = "true";
    }

    console.log(`Running integration tests in these directories: ${dirs}`);
    for (const dir of dirs) {
      const launchArgs = getLaunchArgs(dir as TestDir);
      console.log(`Next integration test dir: ${dir}`);
      console.log(`Launch args: ${launchArgs}`);
      exitCode = await runTestsWithRetryOnSegfault(
        {
          version: VSCODE_VERSION,
          vscodeExecutablePath,
          extensionDevelopmentPath,
          extensionTestsPath: resolve(__dirname, dir, "index"),
          extensionTestsEnv,
          launchArgs,
        },
        3,
      );
    }
  } catch (err) {
    console.error(`Unexpected exception while running tests: ${err}`);
    if (err instanceof Error) {
      console.error(err.stack);
    }
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

void main();

function getLaunchArgs(dir: TestDir) {
  switch (dir) {
    case TestDir.NoWorksspace:
      return [
        "--disable-extensions",
        "--disable-gpu",
        "--disable-workspace-trust",
        `--user-data-dir=${join(tmpDir.name, dir, "user-data")}`,
      ];

    case TestDir.MinimalWorksspace:
      return [
        "--disable-extensions",
        "--disable-gpu",
        "--disable-workspace-trust",
        `--user-data-dir=${join(tmpDir.name, dir, "user-data")}`,
        resolve(__dirname, "../../test/data"),
      ];

    case TestDir.CliIntegration:
      // CLI integration tests requires a multi-root workspace so that the data and the QL sources are accessible.
      return [
        "--disable-workspace-trust",
        "--disable-gpu",
        resolve(__dirname, "../../test/data"),

        // explicitly disable extensions that are known to interfere with the CLI integration tests
        "--disable-extension",
        "eamodio.gitlens",
        "--disable-extension",
        "github.codespaces",
        "--disable-extension",
        "github.copilot",
        `--user-data-dir=${join(tmpDir.name, dir, "user-data")}`,
      ].concat(
        process.env.TEST_CODEQL_PATH ? [process.env.TEST_CODEQL_PATH] : [],
      );

    default:
      assertNever(dir);
  }
}
