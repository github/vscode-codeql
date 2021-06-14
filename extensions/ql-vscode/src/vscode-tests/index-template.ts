import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';
import { ensureCli } from './ensureCli';
import { env } from 'vscode';


// Use this handler to avoid swallowing unhandled rejections.
process.on('unhandledRejection', e => {
  console.error('Unhandled rejection.');
  console.error(e);
  // Must use a setTimeout in order to ensure the log is fully flushed before exiting
  setTimeout(() => {
    process.exit(-1);
  }, 2000);
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
export async function runTestsInDirectory(testsRoot: string, useCli = false): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    globalSetup: [],
    globalTeardown: [],
  } as any);

  (mocha.options as any).globalSetup.push(
    // convert this function into an noop since it should not run during tests.
    // If it does run during tests, then it can cause some testing environments
    // to hang.
    (env as any).openExternal = () => { /**/ }
  );

  await ensureCli(useCli);

  return new Promise((resolve, reject) => {
    console.log(`Adding test cases and helpers from ${testsRoot}`);
    glob('**/**.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return reject(err);
      }

      try {
        // Add test files to the test suite
        files
          .filter(f => f.endsWith('.test.js'))
          .forEach(f => {
            console.log(`Adding test file ${f}`);
            mocha.addFile(path.resolve(testsRoot, f));
          });

        // Add helpers. Helper files add global setup and teardown blocks
        // for a test run.
        files
          .filter(f => f.endsWith('.helper.js'))
          .forEach(f => {
            console.log(`Executing helper ${f}`);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const helper = require(path.resolve(testsRoot, f)).default;
            helper(mocha);
          });

        // Run the mocha test
        mocha.run(failures => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
