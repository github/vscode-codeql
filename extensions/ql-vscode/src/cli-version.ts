import { parse, SemVer } from 'semver';
import { runCodeQlCliCommand } from "./cli";
import { Logger } from "./logging";

/**
 * Get the version of a CodeQL CLI.
 */
export async function getCodeQlCliVersion(codeQlPath: string, logger: Logger): Promise<SemVer | null> {
  const output: string = await runCodeQlCliCommand(
    codeQlPath,
    ["version"],
    ["--format=terse"],
    "Checking CodeQL version",
    logger
  );
  return parse(output.trim());
}
