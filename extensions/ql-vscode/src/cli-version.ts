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
  const match = versionString.match(versionRegex);
  if (match === null) {
    return undefined;
  }
  return {
    buildMetadata: match[5],
    majorVersion: Number.parseInt(match[1], 10),
    minorVersion: Number.parseInt(match[2], 10),
    patchVersion: Number.parseInt(match[3], 10),
    prereleaseVersion: match[4],
    rawString: versionString,
  }
}

/**
 * Regex for parsing semantic versions
 * 
 * From the semver spec https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
 */
const versionRegex = new RegExp(String.raw`^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)` +
  String.raw`(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?` +
  String.raw`(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$`);

/**
 * A version of the CodeQL CLI.
 */
export interface Version {
  /**
   * Build metadata
   * 
   * For example, this will be `abcdef0` for version 2.1.0-alpha.1+abcdef0.
   * Build metadata must be ignored when comparing versions. 
   */
  buildMetadata: string | undefined;

  /**
   * Major version number
   * 
   * For example, this will be `2` for version 2.1.0-alpha.1+abcdef0.
   */
  majorVersion: number;

  /**
   * Minor version number
   * 
   * For example, this will be `1` for version 2.1.0-alpha.1+abcdef0.
   */
  minorVersion: number;

  /**
   * Patch version number
   * 
   * For example, this will be `0` for version 2.1.0-alpha.1+abcdef0.
   */
  patchVersion: number;

  /**
   * Prerelease version
   * 
   * For example, this will be `alpha.1` for version 2.1.0-alpha.1+abcdef0.
   * The prerelease version must be considered when comparing versions.
   */
  prereleaseVersion: string | undefined;

  /**
   * Raw version string
   * 
   * For example, this will be `2.1.0-alpha.1+abcdef0` for version 2.1.0-alpha.1+abcdef0.
   */
  rawString: string;
}
