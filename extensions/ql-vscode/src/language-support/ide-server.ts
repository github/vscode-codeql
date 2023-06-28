import { ProgressLocation, TextEditor, window } from "vscode";
import {
  LanguageClient,
  NotificationType,
  StreamInfo,
} from "vscode-languageclient/node";
import { shouldDebugIdeServer, spawnServer } from "../codeql-cli/cli";
import { QueryServerConfig } from "../config";
import { ideServerLogger } from "../common/logging/vscode";

/**
 * Managing the language server for CodeQL.
 */

/**
 * Create a new CodeQL language server.
 */
export function createIDEServer(
  config: QueryServerConfig,
): CodeQLLanguageClient {
  return new CodeQLLanguageClient(config);
}

/**
 * CodeQL language server.
 */
export class CodeQLLanguageClient extends LanguageClient {
  constructor(config: QueryServerConfig) {
    super(
      "codeQL.lsp",
      "CodeQL Language Server",
      () => spawnIdeServer(config),
      {
        documentSelector: [
          { language: "ql", scheme: "file" },
          { language: "yaml", scheme: "file", pattern: "**/qlpack.yml" },
          { language: "yaml", scheme: "file", pattern: "**/codeql-pack.yml" },
        ],
        synchronize: {
          configurationSection: "codeQL",
        },
        // Ensure that language server exceptions are logged to the same channel as its output.
        outputChannel: ideServerLogger.outputChannel,
      },
      true,
    );
  }

  notifyVisibilityChange(editors: readonly TextEditor[]) {
    const files = editors
      .filter((e) => e.document.uri.scheme === "file")
      .map((e) => e.document.uri.toString());
    void this.sendNotification(didChangeVisibileFiles, {
      visibleFiles: files,
    });
  }
}

/** Starts a new CodeQL language server process, sending progress messages to the status bar. */
async function spawnIdeServer(config: QueryServerConfig): Promise<StreamInfo> {
  return window.withProgress(
    { title: "CodeQL language server", location: ProgressLocation.Window },
    async (progressReporter, _) => {
      const args = ["--check-errors", "ON_CHANGE"];
      if (shouldDebugIdeServer()) {
        args.push(
          "-J=-agentlib:jdwp=transport=dt_socket,address=localhost:9009,server=y,suspend=n,quiet=y",
        );
      }
      const child = spawnServer(
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

/**
 * Custom notification type for when the set of visible files changes.
 */
interface DidChangeVisibileFilesParams {
  visibleFiles: string[];
}

const didChangeVisibileFiles: NotificationType<DidChangeVisibileFilesParams> =
  new NotificationType("textDocument/codeQLDidChangeVisibleFiles");
