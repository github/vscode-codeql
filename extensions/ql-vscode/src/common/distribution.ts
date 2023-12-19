import { platform } from "os";

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

export function codeQlLauncherName(): string {
  return platform() === "win32" ? "codeql.exe" : "codeql";
}

export function deprecatedCodeQlLauncherName(): string | undefined {
  return platform() === "win32" ? "codeql.cmd" : undefined;
}
