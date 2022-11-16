import * as path from "path";
import * as Mocha from "mocha";
import * as glob from "glob-promise";
import { ensureCli } from "./ensureCli";
import { env } from "vscode";
import { testConfigHelper } from "./test-config";

// Use this handler to avoid swallowing unhandled rejections.
process.on("unhandledRejection", (e) => {
  console.error("Unhandled rejection.");
  console.error(e);
  // Must use a setTimeout in order to ensure the log is fully flushed before exiting
  setTimeout(() => {
    process.exit(-1);
  }, 2000);
});

process.on("exit", (code) => {
  // If the exit code is 7, then the test runner has completed, but
  // there was an error in exiting vscode.
  if (code === 7) {
    console.warn(
      "Attempted to exit with code 7. This is likely due to a failure to exit vscode. Ignoring this and exiting with code 0.",
    );
    process.exit(0);
  }
});

/**
 * Helper function that runs all Mocha tests found in the
 * given test root directory.
 *
 * For each integration test suite, `vscode-test` expects
 * a test runner script exporting a function with the signature:
 * ```ts
 * export function run(): Promise<void>
 * ```
 *
 * To create an integration test suite:
 * - create a directory beside this file
 * - create integration tests in the directory, named `<name>.test.ts`
 * - create an `index.ts` file in the directory, containing:
 * ```ts
 * import { runTestsInDirectory } from '../index-template';
 * export function run(): Promise<void> {
 *   return runTestsInDirectory(__dirname);
 * }
 * ```
 *
 * After https://github.com/microsoft/TypeScript/issues/420 is implemented,
 * this pattern can be expressed more neatly using a module interface.
 */
export async function runTestsInDirectory(
  testsRoot: string,
  useCli = false,
): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "bdd",
    color: true,
    globalSetup: [],
    globalTeardown: [],
  } as any);

  (mocha.options as any).globalSetup.push(
    // convert this function into an noop since it should not run during tests.
    // If it does run during tests, then it can cause some testing environments
    // to hang.
    ((env as any).openExternal = () => {
      /**/
    }),
  );

  await ensureCli(useCli);

  console.log(`Adding test cases and helpers from ${testsRoot}`);

  const files = await glob("**/**.js", { cwd: testsRoot });

  // Add test files to the test suite
  files
    .filter((f) => f.endsWith(".test.js"))
    .forEach((f) => {
      console.log(`Adding test file ${f}`);
      mocha.addFile(path.resolve(testsRoot, f));
    });

  // Setup the config helper. This needs to run before other helpers so any config they setup
  // is restored.
  await testConfigHelper(mocha);

  // Add helpers. Helper files add global setup and teardown blocks
  // for a test run.
  files
    .filter((f) => f.endsWith(".helper.js"))
    .forEach((f) => {
      console.log(`Executing helper ${f}`);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const helper = require(path.resolve(testsRoot, f)).default;
      helper(mocha);
    });

  return new Promise((resolve, reject) => {
    // Run the mocha test
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
        return;
      }

      resolve();
    });
  });
}
