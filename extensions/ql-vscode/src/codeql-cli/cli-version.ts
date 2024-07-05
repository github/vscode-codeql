import type { SemVer } from "semver";
import { parse } from "semver";
import { runJsonCodeQlCliCommand } from "./cli-command";
import type { Logger } from "../common/logging";
import { getErrorMessage } from "../common/helpers-pure";

interface VersionResult {
  version: string;
  features: CliFeatures | undefined;
}

export interface CliFeatures {
  featuresInVersionResult?: boolean;
  mrvaPackCreate?: boolean;
  generateSummarySymbolMap?: boolean;
}

export interface VersionAndFeatures {
  version: SemVer;
  features: CliFeatures;
}

/**
 * Get the version of a CodeQL CLI.
 */
export async function getCodeQlCliVersion(
  codeQlPath: string,
  logger: Logger,
): Promise<VersionAndFeatures | undefined> {
  try {
    const output: VersionResult = await runJsonCodeQlCliCommand<VersionResult>(
      codeQlPath,
      ["version"],
      ["--format=json"],
      "Checking CodeQL version",
      logger,
    );

    const version = parse(output.version.trim()) || undefined;
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
