import { execFile } from "child_process";
import { promisify } from "util";

import type { BaseLogger } from "../common/logging";
import type { ProgressReporter } from "../common/logging/vscode";
import {
  getChildProcessErrorMessage,
  getErrorMessage,
} from "../common/helpers-pure";

/**
 * Flags to pass to all cli commands.
 */
export const LOGGING_FLAGS = ["-v", "--log-to-stderr"];

/**
 * Runs a CodeQL CLI command without invoking the CLI server, deserializing the output as JSON.
 * @param codeQlPath The path to the CLI.
 * @param command The `codeql` command to be run, provided as an array of command/subcommand names.
 * @param commandArgs The arguments to pass to the `codeql` command.
 * @param description Description of the action being run, to be shown in log and error messages.
 * @param logger Logger to write command log messages, e.g. to an output channel.
 * @param progressReporter Used to output progress messages, e.g. to the status bar.
 * @returns A JSON object parsed from the contents of the command's stdout, if the command succeeded.
 */
export async function runJsonCodeQlCliCommand<OutputType>(
  codeQlPath: string,
  command: string[],
  commandArgs: string[],
  description: string,
  logger: BaseLogger,
  progressReporter?: ProgressReporter,
): Promise<OutputType> {
  // Add logging arguments first, in case commandArgs contains positional parameters.
  const args = command.concat(LOGGING_FLAGS).concat(commandArgs);
  const argsString = args.join(" ");
  let stdout: string;
  try {
    if (progressReporter !== undefined) {
      progressReporter.report({ message: description });
    }
    void logger.log(
      `${description} using CodeQL CLI: ${codeQlPath} ${argsString}...`,
    );
    const result = await promisify(execFile)(codeQlPath, args);
    void logger.log(result.stderr);
    void logger.log("CLI command succeeded.");
    stdout = result.stdout;
  } catch (err) {
    throw new Error(
      `${description} failed: ${getChildProcessErrorMessage(err)}`,
    );
  }

  try {
    return JSON.parse(stdout) as OutputType;
  } catch (err) {
    throw new Error(
      `Parsing output of ${description} failed: ${getErrorMessage(err)}`,
    );
  }
}
