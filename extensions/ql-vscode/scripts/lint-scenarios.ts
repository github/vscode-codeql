import { pathExists, readFile } from "fs-extra";
import { resolve, relative } from "path";

import Ajv from "ajv";
import { createGenerator } from "ts-json-schema-generator";

import { getFiles } from "./util/files";

const extensionDirectory = resolve(__dirname, "..");
const rootDirectory = resolve(extensionDirectory, "../..");
const scenariosDirectory = resolve(
  extensionDirectory,
  "src/common/mock-gh-api/scenarios",
);

const debug = process.env.RUNNER_DEBUG || process.argv.includes("--debug");

async function lintScenarios() {
  const schema = createGenerator({
    path: resolve(
      extensionDirectory,
      "src/common/mock-gh-api/gh-api-request.ts",
    ),
    tsconfig: resolve(extensionDirectory, "tsconfig.json"),
    type: "GitHubApiRequest",
    skipTypeCheck: true,
    topRef: true,
    additionalProperties: true,
  }).createSchema("GitHubApiRequest");

  const ajv = new Ajv();

  if (!ajv.validateSchema(schema)) {
    throw new Error(`Invalid schema: ${ajv.errorsText()}`);
  }

  const validate = ajv.compile(schema);

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

    if (!validate(data)) {
      validate.errors?.forEach((error) => {
        // https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-error-message
        console.log(
          `::error file=${relative(rootDirectory, file)}::${
            error.instancePath
          }: ${error.message}`,
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

lintScenarios().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
