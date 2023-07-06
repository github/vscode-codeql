import { platform } from "os";
import { Open } from "unzipper";
import { join } from "path";
import { pathExists, chmod } from "fs-extra";

/**
 * Get the name of the codeql cli installation we prefer to install, based on our current platform.
 */
export function getRequiredAssetName(): string {
  switch (platform()) {
    case "linux":
      return "codeql-linux64.zip";
    case "darwin":
      return "codeql-osx64.zip";
    case "win32":
      return "codeql-win64.zip";
    default:
      return "codeql.zip";
  }
}

export async function extractZipArchive(
  archivePath: string,
  outPath: string,
): Promise<void> {
  const archive = await Open.file(archivePath);
  await archive.extract({
    concurrency: 4,
    path: outPath,
  });
  // Set file permissions for extracted files
  await Promise.all(
    archive.files.map(async (file) => {
      // Only change file permissions if within outPath (path.join normalises the path)
      const extractedPath = join(outPath, file.path);
      if (
        extractedPath.indexOf(outPath) !== 0 ||
        !(await pathExists(extractedPath))
      ) {
        return Promise.resolve();
      }
      return chmod(extractedPath, file.externalFileAttributes >>> 16);
    }),
  );
}

export function codeQlLauncherName(): string {
  return platform() === "win32" ? "codeql.exe" : "codeql";
}

export function deprecatedCodeQlLauncherName(): string | undefined {
  return platform() === "win32" ? "codeql.cmd" : undefined;
}
