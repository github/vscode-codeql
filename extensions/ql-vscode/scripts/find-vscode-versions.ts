import { resolve } from "path";
import { readJSON } from "fs-extra";
import { minVersion } from "semver";
import { getVersionInformation } from "./util/vscode-versions";

const extensionDirectory = resolve(__dirname, "..");

async function findVsCodeVersions() {
  const packageJson = await readJSON(
    resolve(extensionDirectory, "package.json"),
  );

  const minimumVsCodeVersion = minVersion(packageJson.engines.vscode)?.version;
  if (!minimumVsCodeVersion) {
    throw new Error("Could not find minimum VS Code version");
  }

  const versionInformation = await getVersionInformation(minimumVsCodeVersion);
  console.log(
    `VS Code ${versionInformation.vscodeVersion} uses Electron ${versionInformation.electronVersion}, Node ${versionInformation.nodeVersion} and Chromium ${versionInformation.chromiumVersion}`,
  );
}

findVsCodeVersions().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
