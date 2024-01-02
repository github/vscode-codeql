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

  packageJson.engines.node = `^${versionInformation.nodeVersion}`;
  packageJson.devDependencies["@types/node"] =
    `${versionInformation.nodeVersion}`;

  await outputFile(
    join(extensionDirectory, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );

  console.log("Updated package.json, now running npm install");

  execSync("npm install", { cwd: extensionDirectory, stdio: "inherit" });

  console.log("Node version updated successfully");
}

updateNodeVersion().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
