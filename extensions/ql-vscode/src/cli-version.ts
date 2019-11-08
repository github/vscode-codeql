import { runCodeQlCliCommand } from "./cli";
import { Logger } from "./logging";

/**
 * Get the version of a CodeQL CLI.
 */
export async function getCodeQlCliVersion(codeQlPath: string, logger: Logger): Promise<Version | undefined> {
  const output: string = await runCodeQlCliCommand(
    codeQlPath,
    ["version"],
    ["--format=terse"],
    "Checking CodeQL version",
    logger
  );
  return tryParseVersionString(output.trim());
}

/**
 * Try to parse a version string, returning undefined if we can't parse it.
 * 
 * Version strings must contain a major, minor, and patch version.  They may optionally
 * start with "v" and may optionally contain some "tail" string after the major, minor, and
 * patch versions, for example as in `v2.1.0+baf5bff`.
 */
export function tryParseVersionString(versionString: string): Version | undefined {
  const versionRegex = /v?([0-9]+)\.([0-9]+)\.([0-9]+)(?:[+\-\.](.*))?/;
  const match = versionString.match(versionRegex);
  if (match === null) {
    return undefined;
  }
  return {
    majorVersion: Number.parseInt(match[1], 10),
    minorVersion: Number.parseInt(match[2], 10),
    patchVersion: Number.parseInt(match[3], 10),
    rawString: versionString,
    tailString: match[4]
  }
}

/**
 * A version of the CodeQL CLI.
 */
export interface Version {
  /**
   * The major version number
   * 
   * For example, this will be `2` for version 2.1.0+rc1.
   */
  majorVersion: number;

  /**
   * The minor version number
   * 
   * For example, this will be `1` for version 2.1.0+rc1.
   */
  minorVersion: number;

  /**
   * The patch version number
   * 
   * For example, this will be `0` for version 2.1.0+rc1.
   */
  patchVersion: number;

  /**
   * The raw version string
   * 
   * For example, this will be `2.1.0+rc1` for version 2.1.0+rc1.
   */
  rawString: string;

  /**
   * The part of the version string after the major, minor, and patch versions and one of the following separators:
   * `+`, `-`, or `.`.
   * 
   * For example, this will be `rc1` for version 2.1.0+rc1.
   */
  tailString: string | undefined;
}
