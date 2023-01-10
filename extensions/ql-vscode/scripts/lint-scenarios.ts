import { pathExists, readFile } from "fs-extra";
import { resolve, relative } from "path";

import { isLeft } from "fp-ts/Either";

import { getFiles } from "./util/files";
import { GitHubApiRequest } from "../src/mocks/gh-api-request";
import { getContextPath, getMessage } from "../src/pure/io-ts";

const extensionDirectory = resolve(__dirname, "..");
const rootDirectory = resolve(extensionDirectory, "../..");
const scenariosDirectory = resolve(extensionDirectory, "src/mocks/scenarios");

const debug = process.env.RUNNER_DEBUG || process.argv.includes("--debug");

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

    if (isLeft(result)) {
      result.left.forEach((error) => {
        // https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-error-message
        console.log(
          `::error file=${relative(rootDirectory, file)}::${getContextPath(
            error.context,
          )}: ${getMessage(error)}`,
        );
      });
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
