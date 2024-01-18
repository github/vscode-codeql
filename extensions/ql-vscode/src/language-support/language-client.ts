import type { TextEditor } from "vscode";
import { ProgressLocation, window } from "vscode";
import type { StreamInfo } from "vscode-languageclient/node";
import { LanguageClient, NotificationType } from "vscode-languageclient/node";
import { shouldDebugLanguageServer, spawnServer } from "../codeql-cli/cli";
import type { QueryServerConfig } from "../config";
import { languageServerLogger } from "../common/logging/vscode";

/**
 * Managing the language client and corresponding server process for CodeQL.
 */

/**
 * Create a new CodeQL language client connected to a language server.
 */
export function createLanguageClient(
  config: QueryServerConfig,
): CodeQLLanguageClient {
  return new CodeQLLanguageClient(config);
}

/**
 * CodeQL language client.
 */
export class CodeQLLanguageClient extends LanguageClient {
  constructor(config: QueryServerConfig) {
    super(
      "codeQL.lsp",
      "CodeQL Language Server",
      () => spawnLanguageServer(config),
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
        outputChannel: languageServerLogger.outputChannel,
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
async function spawnLanguageServer(
  config: QueryServerConfig,
): Promise<StreamInfo> {
  return window.withProgress(
    { title: "CodeQL language server", location: ProgressLocation.Window },
    async (progressReporter, _) => {
      const args = ["--check-errors", "ON_CHANGE"];
      if (shouldDebugLanguageServer()) {
        args.push(
          "-J=-agentlib:jdwp=transport=dt_socket,address=localhost:9009,server=y,suspend=n,quiet=y",
        );
      }
      const child = spawnServer(
        config.codeQlPath,
        "CodeQL language server",
        ["execute", "language-server"],
        args,
        languageServerLogger,
        (data) =>
          languageServerLogger.log(data.toString(), { trailingNewline: false }),
        (data) =>
          languageServerLogger.log(data.toString(), { trailingNewline: false }),
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
