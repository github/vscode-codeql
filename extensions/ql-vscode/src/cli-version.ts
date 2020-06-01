import * as semver from "semver";
import { runCodeQlCliCommand } from "./cli";
import { Logger } from "./logging";

/**
 * Get the version of a CodeQL CLI.
 */
export async function getCodeQlCliVersion(codeQlPath: string, logger: Logger): Promise<semver.SemVer | undefined> {
  const output: string = await runCodeQlCliCommand(
    codeQlPath,
    ["version"],
    ["--format=terse"],
    "Checking CodeQL version",
    logger
  );
  return semver.parse(output.trim()) || undefined;
}
