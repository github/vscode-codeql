import * as fs from "fs-extra";
import * as path from "path";

import Ajv from "ajv";
import * as tsj from "ts-json-schema-generator";

import { getFiles } from "./util/files";

const extensionDirectory = path.resolve(__dirname, "..");
const rootDirectory = path.resolve(extensionDirectory, "../..");
const scenariosDirectory = path.resolve(
  extensionDirectory,
  "src/mocks/scenarios",
);

const debug = process.env.RUNNER_DEBUG || process.argv.includes("--debug");

async function lintScenarios() {
  const schema = tsj
    .createGenerator({
      path: path.resolve(extensionDirectory, "src/mocks/gh-api-request.ts"),
      tsconfig: path.resolve(extensionDirectory, "tsconfig.json"),
      type: "GitHubApiRequest",
      skipTypeCheck: true,
      topRef: true,
      additionalProperties: true,
    })
    .createSchema("GitHubApiRequest");

  const ajv = new Ajv();

  if (!ajv.validateSchema(schema)) {
    throw new Error("Invalid schema: " + ajv.errorsText());
  }

  const validate = await ajv.compile(schema);

  let invalidFiles = 0;

  if (!(await fs.pathExists(scenariosDirectory))) {
    console.error("Scenarios directory does not exist: " + scenariosDirectory);
    // Do not exit with a non-zero status code, as this is not a fatal error.
    return;
  }

  for await (const file of getFiles(scenariosDirectory)) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const contents = await fs.readFile(file, "utf8");
    const data = JSON.parse(contents);

    if (!validate(data)) {
      validate.errors?.forEach((error) => {
        // https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-error-message
        console.log(
          `::error file=${path.relative(rootDirectory, file)}::${
            error.instancePath
          }: ${error.message}`,
        );
      });
      invalidFiles++;
    } else if (debug) {
      console.log(`File '${path.relative(rootDirectory, file)}' is valid`);
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
