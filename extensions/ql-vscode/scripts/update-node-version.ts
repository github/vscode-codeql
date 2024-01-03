import { join, resolve } from "path";
import { execSync } from "child_process";
import { outputFile, readFile, readJSON } from "fs-extra";
import { getVersionInformation } from "./util/vscode-versions";
import { fetchJson } from "./util/fetch";

const extensionDirectory = resolve(__dirname, "..");

interface Release {
  tag_name: string;
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

  let currentNodeVersion = (
    await readFile(join(extensionDirectory, ".nvmrc"), "utf8")
  ).trim();
  if (currentNodeVersion.startsWith("v")) {
    currentNodeVersion = currentNodeVersion.slice(1);
  }

  if (currentNodeVersion === versionInformation.nodeVersion) {
    console.log("Node version is already up to date");
    return;
  }

  console.log("Node version needs to be updated, updating now");

  await outputFile(
    join(extensionDirectory, ".nvmrc"),
    `v${versionInformation.nodeVersion}\n`,
  );

  console.log("Updated .nvmrc");

  const packageJson = await readJSON(
    join(extensionDirectory, "package.json"),
    "utf8",
  );

  // The @types/node version needs to match the first two parts of the Node
  // version, e.g. if the Node version is 18.17.3, the @types/node version
  // should be 18.17.*. This corresponds with the documentation at
  // https://github.com/definitelytyped/definitelytyped#how-do-definitely-typed-package-versions-relate-to-versions-of-the-corresponding-library
  // "The patch version of the type declaration package is unrelated to the library patch version. This allows
  // Definitely Typed to safely update type declarations for the same major/minor version of a library."
  // 18.17.* is equivalent to >=18.17.0 <18.18.0
  const typesNodeVersion = versionInformation.nodeVersion
    .split(".")
    .slice(0, 2)
    .join(".");

  packageJson.engines.node = `^${versionInformation.nodeVersion}`;
  packageJson.devDependencies["@types/node"] = `${typesNodeVersion}.*`;

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
