import { join, resolve } from "path";
import { execSync } from "child_process";
import { outputFile, readJSON } from "fs-extra";
import { getVersionInformation } from "./util/vscode-versions";
import { fetchJson } from "./util/fetch";
import { SemVer } from "semver";

const extensionDirectory = resolve(__dirname, "..");

interface Release {
  tag_name: string;
}

interface NpmViewError {
  error: {
    code: string;
    summary: string;
    detail: string;
  };
}

interface ExecError extends Error {
  status: number;
  stdout: string;
}

function isExecError(e: unknown): e is ExecError {
  return (
    e instanceof Error &&
    "status" in e &&
    typeof e.status === "number" &&
    "stdout" in e &&
    typeof e.stdout === "string"
  );
}

async function updateNodeVersion() {
  const latestVsCodeRelease = await fetchJson<Release>(
    "https://api.github.com/repos/microsoft/vscode/releases/latest",
  );
  const latestVsCodeVersion = latestVsCodeRelease.tag_name;

  console.log(`Latest VS Code version is ${latestVsCodeVersion}`);

  const versionInformation = await getVersionInformation(latestVsCodeVersion);
  console.log(
    `VS Code ${versionInformation.vscodeVersion} uses Electron ${versionInformation.electronVersion} and Node ${versionInformation.nodeVersion}`,
  );

  console.log("Updating files related to the Node version");

  await outputFile(
    join(extensionDirectory, ".nvmrc"),
    `v${versionInformation.nodeVersion}\n`,
  );

  console.log("Updated .nvmrc");

  const packageJson = await readJSON(
    join(extensionDirectory, "package.json"),
    "utf8",
  );

  const nodeVersion = new SemVer(versionInformation.nodeVersion);

  // The @types/node version needs to match the first two parts of the Node
  // version, e.g. if the Node version is 18.17.3, the @types/node version
  // should be 18.17.*. This corresponds with the documentation at
  // https://github.com/definitelytyped/definitelytyped#how-do-definitely-typed-package-versions-relate-to-versions-of-the-corresponding-library
  // "The patch version of the type declaration package is unrelated to the library patch version. This allows
  // Definitely Typed to safely update type declarations for the same major/minor version of a library."
  // 18.17.* is equivalent to >=18.17.0 <18.18.0
  // In some cases, the @types/node version matching the exact Node version may not exist, in which case we'll try
  // the next lower minor version, and so on, until we find a version that exists.
  const typesNodeSemver = new SemVer(nodeVersion);
  typesNodeSemver.patch = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const typesNodeVersion = `${typesNodeSemver.major}.${typesNodeSemver.minor}.*`;

    try {
      // Check that this version actually exists
      console.log(`Checking if @types/node@${typesNodeVersion} exists`);

      execSync(`npm view --json "@types/node@${typesNodeVersion}"`, {
        encoding: "utf-8",
        stdio: "pipe",
        maxBuffer: 10 * 1024 * 1024,
      });

      console.log(`@types/node@${typesNodeVersion} exists`);

      // If it exists, we can break out of this loop
      break;
    } catch (e: unknown) {
      if (!isExecError(e)) {
        throw e;
      }

      const error = JSON.parse(e.stdout) as NpmViewError;
      if (error.error.code !== "E404") {
        throw new Error(error.error.detail);
      }

      console.log(
        `@types/node package doesn't exist for ${typesNodeVersion}, trying a lower version (${error.error.summary})`,
      );

      // This means the version doesn't exist, so we'll try decrementing the minor version
      typesNodeSemver.minor -= 1;
      if (typesNodeSemver.minor < 0) {
        throw new Error(
          `Could not find a suitable @types/node version for Node ${nodeVersion.format()}`,
        );
      }
    }
  }

  packageJson.engines.node = `^${versionInformation.nodeVersion}`;
  packageJson.devDependencies["@types/node"] =
    `${typesNodeSemver.major}.${typesNodeSemver.minor}.*`;

  await outputFile(
    join(extensionDirectory, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );

  console.log("Updated package.json, now running npm install");

  execSync("npm install", { cwd: extensionDirectory, stdio: "inherit" });
  // Always use the latest patch version of @types/node
  execSync("npm upgrade @types/node", {
    cwd: extensionDirectory,
    stdio: "inherit",
  });

  console.log("Node version updated successfully");
}

updateNodeVersion().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
