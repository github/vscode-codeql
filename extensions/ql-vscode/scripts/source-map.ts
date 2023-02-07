/**
 * This scripts helps finding the original source file and line number for a
 * given file and line number in the compiled extension. It currently only
 * works with released extensions.
 *
 * Usage: npx ts-node scripts/source-map.ts <version-number> <filename>:<line>:<column>
 * For example: npx ts-node scripts/source-map.ts v1.7.8 "/Users/user/.vscode/extensions/github.vscode-codeql-1.7.8/out/extension.js:131164:13"
 */

import { spawnSync } from "child_process";
import { basename, resolve } from "path";
import { pathExists, readJSON } from "fs-extra";
import { SourceMapConsumer } from "source-map";
import { Open } from "unzipper";

if (process.argv.length !== 4) {
  console.error(
    "Expected 2 arguments - the version number and the filename:line number",
  );
}

const versionNumber = process.argv[2].startsWith("v")
  ? process.argv[2]
  : `v${process.argv[2]}`;
const filenameAndLine = process.argv[3];

async function extractSourceMap() {
  const releaseAssetsDirectory = resolve(
    __dirname,
    "..",
    "release-assets",
    versionNumber,
  );
  const sourceMapsDirectory = resolve(
    __dirname,
    "..",
    "artifacts",
    "source-maps",
    versionNumber,
  );

  if (!(await pathExists(sourceMapsDirectory))) {
    console.log("Downloading source maps...");

    const release = runGhJSON<Release>([
      "release",
      "view",
      versionNumber,
      "--json",
      "id,name,assets",
    ]);

    const sourcemapAsset = release.assets.find(
      (asset) => asset.name === `vscode-codeql-sourcemaps-${versionNumber}.zip`,
    );

    if (sourcemapAsset) {
      // This downloads a ZIP file of the source maps
      runGh([
        "release",
        "download",
        versionNumber,
        "--pattern",
        sourcemapAsset.name,
        "--dir",
        releaseAssetsDirectory,
      ]);

      const file = await Open.file(
        resolve(releaseAssetsDirectory, sourcemapAsset.name),
      );
      await file.extract({ path: sourceMapsDirectory });
    } else {
      const workflowRuns = runGhJSON<WorkflowRunListItem[]>([
        "run",
        "list",
        "--workflow",
        "release.yml",
        "--branch",
        versionNumber,
        "--json",
        "databaseId,number",
      ]);

      if (workflowRuns.length !== 1) {
        throw new Error(
          `Expected exactly one workflow run for ${versionNumber}, got ${workflowRuns.length}`,
        );
      }

      const workflowRun = workflowRuns[0];

      runGh([
        "run",
        "download",
        workflowRun.databaseId.toString(),
        "--name",
        "vscode-codeql-sourcemaps",
        "--dir",
        sourceMapsDirectory,
      ]);
    }
  }

  const [filename, line, column] = filenameAndLine.split(":", 3);

  const fileBasename = basename(filename);

  const sourcemapName = `${fileBasename}.map`;
  const sourcemapPath = resolve(sourceMapsDirectory, sourcemapName);

  if (!(await pathExists(sourcemapPath))) {
    throw new Error(`No source map found for ${fileBasename}`);
  }

  const rawSourceMap = await readJSON(sourcemapPath);

  const originalPosition = await SourceMapConsumer.with(
    rawSourceMap,
    null,
    async function (consumer) {
      return consumer.originalPositionFor({
        line: parseInt(line),
        column: parseInt(column),
      });
    },
  );

  if (!originalPosition.source) {
    throw new Error(`No source found for ${filenameAndLine}`);
  }

  const originalFilename = resolve(filename, "..", originalPosition.source);

  console.log(
    `${originalFilename}:${originalPosition.line}:${originalPosition.column}`,
  );
}

extractSourceMap().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});

function runGh(args: readonly string[]): string {
  const gh = spawnSync("gh", args);
  if (gh.status !== 0) {
    throw new Error(
      `Failed to get the source map for ${versionNumber}: ${gh.stderr}`,
    );
  }
  return gh.stdout.toString("utf-8");
}

function runGhJSON<T>(args: readonly string[]): T {
  return JSON.parse(runGh(args));
}

type ReleaseAsset = {
  id: string;
  name: string;
};

type Release = {
  id: string;
  name: string;
  assets: ReleaseAsset[];
};

type WorkflowRunListItem = {
  databaseId: number;
  number: number;
};
