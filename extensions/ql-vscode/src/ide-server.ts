import { ProgressLocation, window } from "vscode";
import { StreamInfo } from "vscode-languageclient";
import * as cli from "./cli";
import { QueryServerConfig } from "./config";
import { ideServerLogger } from "./common";

/**
 * Managing the language server for CodeQL.
 */

/** Starts a new CodeQL language server process, sending progress messages to the status bar. */
export async function spawnIdeServer(
  config: QueryServerConfig,
): Promise<StreamInfo> {
  return window.withProgress(
    { title: "CodeQL language server", location: ProgressLocation.Window },
    async (progressReporter, _) => {
      const args = ["--check-errors", "ON_CHANGE"];
      if (cli.shouldDebugIdeServer()) {
        args.push(
          "-J=-agentlib:jdwp=transport=dt_socket,address=localhost:9009,server=y,suspend=n,quiet=y",
        );
      }
      const child = cli.spawnServer(
        config.codeQlPath,
        "CodeQL language server",
        ["execute", "language-server"],
        args,
        ideServerLogger,
        (data) =>
          ideServerLogger.log(data.toString(), { trailingNewline: false }),
        (data) =>
          ideServerLogger.log(data.toString(), { trailingNewline: false }),
        progressReporter,
      );
      return { writer: child.stdin!, reader: child.stdout! };
    },
  );
}
