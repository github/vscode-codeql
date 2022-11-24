import * as os from "os";
import * as unzipper from "unzipper";
import * as path from "path";
import * as fs from "fs-extra";

/**
 * Get the name of the codeql cli installation we prefer to install, based on our current platform.
 */
export function getRequiredAssetName(): string {
  switch (os.platform()) {
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
  const archive = await unzipper.Open.file(archivePath);
  await archive.extract({
    concurrency: 4,
    path: outPath,
  });
  // Set file permissions for extracted files
  await Promise.all(
    archive.files.map(async (file) => {
      // Only change file permissions if within outPath (path.join normalises the path)
      const extractedPath = path.join(outPath, file.path);
      if (
        extractedPath.indexOf(outPath) !== 0 ||
        !(await fs.pathExists(extractedPath))
      ) {
        return Promise.resolve();
      }
      return fs.chmod(extractedPath, file.externalFileAttributes >>> 16);
    }),
  );
}

export function codeQlLauncherName(): string {
  return os.platform() === "win32" ? "codeql.exe" : "codeql";
}

export function deprecatedCodeQlLauncherName(): string | undefined {
  return os.platform() === "win32" ? "codeql.cmd" : undefined;
}
