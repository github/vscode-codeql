import { createHash } from "crypto";
import { pathExists, readFile } from "fs-extra";
import { resolve, relative } from "path";

import { isLeft } from "fp-ts/Either";

import { getFiles } from "./util/files";
import { GitHubApiRequest } from "../src/mocks/gh-api-request";
import { getContextPath, getErrors, getMessage } from "../src/pure/io-ts";

const extensionDirectory = resolve(__dirname, "..");
const rootDirectory = resolve(extensionDirectory, "../..");
const scenariosDirectory = resolve(extensionDirectory, "src/mocks/scenarios");

const debug = process.env.RUNNER_DEBUG || process.argv.includes("--debug");

// A mapping from filename to error hash. The hash is there to ensure the
// linting will start failing when the error message changes.
const expectedInvalid: Record<string, string> = {
  "invalid-github-api-response/1-submitVariantAnalysis.json":
    "f9eed19b2c4d013014549a63cddfdc4611bdf34cc4baad5c7088e64f53c5e405",
};

async function lintScenarios() {
  let invalidFiles = 0;

  if (!(await pathExists(scenariosDirectory))) {
    console.error(`Scenarios directory does not exist: ${scenariosDirectory}`);
    // Do not exit with a non-zero status code, as this is not a fatal error.
    return;
  }

  for await (const file of getFiles(scenariosDirectory)) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const contents = await readFile(file, "utf8");
    const data = JSON.parse(contents);

    const result = GitHubApiRequest.decode(data);

    const expectedInvalidFilename = relative(scenariosDirectory, file);

    if (isLeft(result)) {
      // The file is invalid.
      const hash = createHash("sha256")
        .update(JSON.stringify(getErrors(result)))
        .digest("hex");

      if (expectedInvalidFilename in expectedInvalid) {
        // The file is expected to be invalid
        if (expectedInvalid[expectedInvalidFilename] !== hash) {
          console.log(
            `::error file=${relative(
              rootDirectory,
              file,
            )}::Hash mismatch for invalid scenario: ${hash}, expected: ${
              expectedInvalid[expectedInvalidFilename]
            }`,
          );
          invalidFiles++;
        } else if (debug) {
          console.log(
            `File '${relative(rootDirectory, file)}' is invalid as expected`,
          );
        }
      } else {
        result.left.forEach((error) => {
          // https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-error-message
          console.log(
            `::error file=${relative(rootDirectory, file)}::${getContextPath(
              error.context,
            )}: ${getMessage(error)}`,
          );
        });
        invalidFiles++;
      }
    } else if (expectedInvalidFilename in expectedInvalid) {
      console.log(
        `::error file=${relative(
          rootDirectory,
          file,
        )}::Expected scenario to be invalid, but it is valid`,
      );
      invalidFiles++;
    } else if (debug) {
      console.log(`File '${relative(rootDirectory, file)}' is valid`);
    }
  }

  if (invalidFiles > 0) {
    process.exit(1);
  }
}

lintScenarios().catch((e) => {
  console.error(e);
  process.exit(2);
});
