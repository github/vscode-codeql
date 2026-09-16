import { minVersion, valid } from "semver";
import { fetchJson, fetchText } from "./fetch";

type VsCodePackageJson = {
  devDependencies?: {
    electron?: string;
  };
};

async function getVsCodePackageJson(
  version: string,
): Promise<VsCodePackageJson> {
  return await fetchJson(
    `https://raw.githubusercontent.com/microsoft/vscode/${version}/package.json`,
  );
}

async function getVsCodeNpmrc(version: string): Promise<string> {
  return await fetchText(
    `https://raw.githubusercontent.com/microsoft/vscode/${version}/.npmrc`,
  );
}

export function parseElectronVersion(npmrc: string): string {
  const electronVersion = /^target="([^"]+)"$/m.exec(npmrc)?.[1];
  if (!electronVersion || !valid(electronVersion)) {
    throw new Error(
      "Could not find a valid Electron version in VS Code .npmrc",
    );
  }

  return electronVersion;
}

async function getVsCodeElectronVersion(version: string): Promise<string> {
  const packageJson = await getVsCodePackageJson(version);
  const packageElectronVersion = packageJson.devDependencies?.electron;
  if (packageElectronVersion) {
    const electronVersion = minVersion(packageElectronVersion)?.version;
    if (!electronVersion) {
      throw new Error(
        "Could not find a valid Electron version in VS Code package.json",
      );
    }

    return electronVersion;
  }

  return parseElectronVersion(await getVsCodeNpmrc(version));
}

interface ElectronVersion {
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

type VersionInformation = {
  vscodeVersion: string;
  electronVersion: string;
  nodeVersion: string;
  chromiumVersion: string;
};

export async function getVersionInformation(
  vscodeVersion: string,
): Promise<VersionInformation> {
  const electronVersion = await getVsCodeElectronVersion(vscodeVersion);

  const electronReleases = await getElectronReleases();

  const electronRelease = electronReleases.find(
    (release) => release.version === electronVersion,
  );
  if (!electronRelease) {
    throw new Error(`Could not find Electron release ${electronVersion}`);
  }

  return {
    vscodeVersion,
    electronVersion,
    nodeVersion: electronRelease.node,
    chromiumVersion: electronRelease.chrome,
  };
}
