import { spawnSync } from "child_process";
import { resolve } from "path";
import { appendFile, outputJson, readJson } from "fs-extra";
import { SemVer } from "semver";

const supportedCliVersionsPath = resolve(
  __dirname,
  "..",
  "supported_cli_versions.json",
);

async function bumpSupportedCliVersions() {
  const existingVersions = (await readJson(
    supportedCliVersionsPath,
  )) as string[];

  const release = runGhJSON<Release>([
    "release",
    "view",
    "--json",
    "id,name",
    "--repo",
    "github/codeql-cli-binaries",
  ]);

  // There are two cases:
  // - Replace the version if it's the same major and minor version
  // - Prepend the version if it's a new major or minor version

  const latestSupportedVersion = new SemVer(existingVersions[0]);
  const latestReleaseVersion = new SemVer(release.name);

  if (latestSupportedVersion.compare(latestReleaseVersion) === 0) {
    console.log("No need to update supported CLI versions");
    return;
  }

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `PREVIOUS_VERSION=${existingVersions[0]}\n`,
      {
        encoding: "utf-8",
      },
    );
  }

  if (
    latestSupportedVersion.major === latestReleaseVersion.major &&
    latestSupportedVersion.minor === latestReleaseVersion.minor
  ) {
    existingVersions[0] = release.name;
    console.log(`Replaced latest supported CLI version with ${release.name}`);
  } else {
    existingVersions.unshift(release.name);
    console.log(`Added latest supported CLI version ${release.name}`);
  }

  await outputJson(supportedCliVersionsPath, existingVersions, {
    spaces: 2,
    finalEOL: true,
  });

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `LATEST_VERSION=${existingVersions[0]}\n`,
      {
        encoding: "utf-8",
      },
    );
  }
}

bumpSupportedCliVersions().catch((e: unknown) => {
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

type Release = {
  id: string;
  name: string;
};
