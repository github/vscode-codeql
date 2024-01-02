import { resolve } from "path";
import { readJSON } from "fs-extra";
import { minVersion } from "semver";

const extensionDirectory = resolve(__dirname, "..");

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Could not fetch ${url}: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

type VsCodePackageJson = {
  devDependencies: {
    electron: string;
  };
};

async function getVsCodePackageJson(
  version: string,
): Promise<VsCodePackageJson> {
  return await fetchJson(
    `https://raw.githubusercontent.com/microsoft/vscode/${version}/package.json`,
  );
}

export interface ElectronVersion {
  version: string;
  date: string;
  node: string;
  v8: string;
  uv: string;
  zlib: string;
  openssl: string;
  modules: string;
  chrome: string;
  files: string[];
  body?: string;
  apm?: string;
}

async function getElectronReleases(): Promise<ElectronVersion[]> {
  return await fetchJson("https://releases.electronjs.org/releases.json");
}

async function findVsCodeVersions() {
  const packageJson = await readJSON(
    resolve(extensionDirectory, "package.json"),
  );

  const minimumVsCodeVersion = minVersion(packageJson.engines.vscode)?.version;
  if (!minimumVsCodeVersion) {
    throw new Error("Could not find minimum VS Code version");
  }

  const vsCodePackageJson = await getVsCodePackageJson(minimumVsCodeVersion);
  const electronVersion = minVersion(vsCodePackageJson.devDependencies.electron)
    ?.version;
  if (!electronVersion) {
    throw new Error("Could not find Electron version");
  }

  console.log(
    `VS Code ${minimumVsCodeVersion} uses Electron ${electronVersion}`,
  );

  const electronReleases = await getElectronReleases();

  const electronRelease = electronReleases.find(
    (release) => release.version === electronVersion,
  );
  if (!electronRelease) {
    throw new Error(`Could not find Electron release ${electronVersion}`);
  }

  console.log(
    `Electron ${electronRelease.version} uses Node ${electronRelease.node} and Chromium ${electronRelease.chrome}`,
  );
}

findVsCodeVersions().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
