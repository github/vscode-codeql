/**
 * This scripts helps finding the original source file and line number for a
 * given file and line number in the compiled extension. It currently only
 * works with released extensions.
 *
 * Usage: npx ts-node scripts/source-map.ts <version-number> <filename>:<line>:<column>
 * For example: npx ts-node scripts/source-map.ts v1.7.8 "/Users/user/.vscode/extensions/github.vscode-codeql-1.7.8/out/extension.js:131164:13"
 *
 * Alternative usage: npx ts-node scripts/source-map.ts <version-number> <multi-line-stacktrace>
 * For example: npx ts-node scripts/source-map.ts v1.7.8 'Error: Failed to find CodeQL distribution.
 *     at CodeQLCliServer.getCodeQlPath (/Users/user/.vscode/extensions/github.vscode-codeql-1.7.8/out/extension.js:131164:13)
 *     at CodeQLCliServer.launchProcess (/Users/user/.vscode/extensions/github.vscode-codeql-1.7.8/out/extension.js:131169:24)
 *     at CodeQLCliServer.runCodeQlCliInternal (/Users/user/.vscode/extensions/github.vscode-codeql-1.7.8/out/extension.js:131194:24)
 *     at CodeQLCliServer.runJsonCodeQlCliCommand (/Users/user/.vscode/extensions/github.vscode-codeql-1.7.8/out/extension.js:131330:20)
 *     at CodeQLCliServer.resolveRam (/Users/user/.vscode/extensions/github.vscode-codeql-1.7.8/out/extension.js:131455:12)
 *     at QueryServerClient2.startQueryServerImpl (/Users/user/.vscode/extensions/github.vscode-codeql-1.7.8/out/extension.js:138618:21)'
 */

import { spawnSync } from "child_process";
import { basename, resolve } from "path";
import { pathExists, readJSON } from "fs-extra";
import type { RawSourceMap } from "source-map";
import { SourceMapConsumer } from "source-map";
import { unzipToDirectorySequentially } from "../src/common/unzip";

if (process.argv.length !== 4) {
  console.error(
    "Expected 2 arguments - the version number and the filename:line number",
  );
}

const stackLineRegex =
  /at (?<name>.*)? \((?<file>.*):(?<line>\d+):(?<column>\d+)\)/gm;

const versionNumber = process.argv[2].startsWith("v")
  ? process.argv[2]
  : `v${process.argv[2]}`;
const stacktrace = process.argv[3];

async function extractSourceMap() {
  const releaseAssetsDirectory = resolve(
    __dirname,
    "..",
    "artifacts",
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
      (asset) =>
        asset.label === `vscode-codeql-sourcemaps-${versionNumber}.zip` ||
        asset.name === "vscode-codeql-sourcemaps.zip",
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

      await unzipToDirectorySequentially(
        resolve(releaseAssetsDirectory, sourcemapAsset.name),
        sourceMapsDirectory,
      );
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

  if (stacktrace.includes("at")) {
    const rawSourceMaps = new Map<string, RawSourceMap | null>();

    const mappedStacktrace = await replaceAsync(
      stacktrace,
      stackLineRegex,
      async (match, name, file, line, column) => {
        if (!rawSourceMaps.has(file)) {
          try {
            const rawSourceMap: RawSourceMap = await readJSON(
              resolve(sourceMapsDirectory, `${basename(file)}.map`),
            );
            rawSourceMaps.set(file, rawSourceMap);
          } catch (e: unknown) {
            // If the file is not found, we will not decode it and not try reading this source map again
            if (e instanceof Error && "code" in e && e.code === "ENOENT") {
              rawSourceMaps.set(file, null);
            } else {
              throw e;
            }
          }
        }

        const sourceMap = rawSourceMaps.get(file);
        if (!sourceMap) {
          return match;
        }

        const originalPosition = await SourceMapConsumer.with(
          sourceMap,
          null,
          async function (consumer) {
            return consumer.originalPositionFor({
              line: parseInt(line, 10),
              column: parseInt(column, 10),
            });
          },
        );

        if (!originalPosition.source) {
          return match;
        }

        const originalFilename = resolve(file, "..", originalPosition.source);

        return `at ${originalPosition.name ?? name} (${originalFilename}:${
          originalPosition.line
        }:${originalPosition.column})`;
      },
    );

    console.log(mappedStacktrace);
  } else {
    // This means it's just a filename:line:column
    const [filename, line, column] = stacktrace.split(":", 3);

    const fileBasename = basename(filename);

    const sourcemapName = `${fileBasename}.map`;
    const sourcemapPath = resolve(sourceMapsDirectory, sourcemapName);

    if (!(await pathExists(sourcemapPath))) {
      throw new Error(`No source map found for ${fileBasename}`);
    }

    const rawSourceMap: RawSourceMap = await readJSON(sourcemapPath);

    const originalPosition = await SourceMapConsumer.with(
      rawSourceMap,
      null,
      async function (consumer) {
        return consumer.originalPositionFor({
          line: parseInt(line, 10),
          column: parseInt(column, 10),
        });
      },
    );

    if (!originalPosition.source) {
      throw new Error(`No source found for ${stacktrace}`);
    }

    const originalFilename = resolve(filename, "..", originalPosition.source);

    console.log(
      `${originalFilename}:${originalPosition.line}:${originalPosition.column}`,
    );
  }
}

extractSourceMap().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});

function runGh(args: readonly string[]): string {
  const gh = spawnSync("gh", args);
  if (gh.status !== 0) {
    throw new Error(`Failed to run gh ${args.join(" ")}: ${gh.stderr}`);
  }
  return gh.stdout.toString("utf-8");
}

function runGhJSON<T>(args: readonly string[]): T {
  return JSON.parse(runGh(args));
}

type ReleaseAsset = {
  id: string;
  name: string;
  label: string;
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

async function replaceAsync(
  str: string,
  regex: RegExp,
  replacer: (substring: string, ...args: string[]) => Promise<string>,
) {
  const promises: Array<Promise<string>> = [];
  str.replace(regex, (match, ...args) => {
    const promise = replacer(match, ...args);
    promises.push(promise);
    return match;
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift() as string);
}
