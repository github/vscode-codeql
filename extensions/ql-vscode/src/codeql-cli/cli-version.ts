import * as semver from "semver";
import { runJsonCodeQlCliCommand } from "./cli";
import { Logger } from "../common/logging";
import { getErrorMessage } from "../common/helpers-pure";
import { CliFeatures, VersionAndFeatures } from "./distribution";

interface VersionResult {
  version: string;
  features: CliFeatures | undefined;
}

/**
 * Get the version of a CodeQL CLI.
 */
export async function getCodeQlCliVersion(
  codeQlPath: string,
  logger: Logger,
): Promise<VersionAndFeatures | undefined> {
  try {
    const output: VersionResult = await runJsonCodeQlCliCommand(
      codeQlPath,
      ["version"],
      ["--format=json"],
      "Checking CodeQL version",
      logger,
    );

    const version = semver.parse(output.version.trim()) || undefined;
    if (version === undefined) {
      return undefined;
    }
    return {
      version,
      features: output.features ?? {},
    };
  } catch (e) {
    // Failed to run the version command. This might happen if the cli version is _really_ old, or it is corrupted.
    // Either way, we can't determine compatibility.
    void logger.log(
      `Failed to run 'codeql version'. Reason: ${getErrorMessage(e)}`,
    );
    return undefined;
  }
}
