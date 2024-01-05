import { join, resolve } from "path";
import { outputFile, readJSON } from "fs-extra";
import { minVersion } from "semver";
import { getVersionInformation } from "./util/vscode-versions";

const extensionDirectory = resolve(__dirname, "..");

async function generateChromiumVersion() {
  const packageJson = await readJSON(
    resolve(extensionDirectory, "package.json"),
  );

  const minimumVsCodeVersion = minVersion(packageJson.engines.vscode)?.version;
  if (!minimumVsCodeVersion) {
    throw new Error("Could not find minimum VS Code version");
  }

  const versionInformation = await getVersionInformation(minimumVsCodeVersion);

  const chromiumMajorVersion = versionInformation.chromiumVersion.split(".")[0];

  console.log(
    `VS Code ${minimumVsCodeVersion} uses Chromium ${chromiumMajorVersion}`,
  );

  await outputFile(
    join(extensionDirectory, "gulpfile.ts", "chromium-version.json"),
    `${JSON.stringify(
      {
        chromiumVersion: chromiumMajorVersion,
        electronVersion: versionInformation.electronVersion,
      },
      null,
      2,
    )}\n`,
  );
}

generateChromiumVersion().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
