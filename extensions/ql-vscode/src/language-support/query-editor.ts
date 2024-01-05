import { Uri, ViewColumn, window } from "vscode";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { QueryRunner } from "../query-server";
import { basename, join } from "path";
import { getErrorMessage } from "../common/helpers-pure";
import { redactableError } from "../common/errors";
import type {
  AppCommandManager,
  QueryEditorCommands,
} from "../common/commands";
import { extLogger } from "../common/logging/vscode";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { telemetryListener } from "../common/vscode/telemetry";

type QueryEditorOptions = {
  commandManager: AppCommandManager;

  queryRunner: QueryRunner;
  cliServer: CodeQLCliServer;

  qhelpTmpDir: string;
};

export function getQueryEditorCommands({
  commandManager,
  queryRunner,
  cliServer,
  qhelpTmpDir,
}: QueryEditorOptions): QueryEditorCommands {
  const openReferencedFileCommand = async (selectedQuery: Uri) =>
    await openReferencedFile(queryRunner, cliServer, selectedQuery);

  return {
    "codeQL.openReferencedFile": openReferencedFileCommand,
    // Since we are tracking extension usage through commands, this command mirrors the "codeQL.openReferencedFile" command
    "codeQL.openReferencedFileContextEditor": openReferencedFileCommand,
    // Since we are tracking extension usage through commands, this command mirrors the "codeQL.openReferencedFile" command
    "codeQL.openReferencedFileContextExplorer": openReferencedFileCommand,
    "codeQL.previewQueryHelp": async (selectedQuery: Uri) =>
      await previewQueryHelp(
        commandManager,
        cliServer,
        qhelpTmpDir,
        selectedQuery,
      ),
    "codeQL.previewQueryHelpContextEditor": async (selectedQuery: Uri) =>
      await previewQueryHelp(
        commandManager,
        cliServer,
        qhelpTmpDir,
        selectedQuery,
      ),
    "codeQL.previewQueryHelpContextExplorer": async (selectedQuery: Uri) =>
      await previewQueryHelp(
        commandManager,
        cliServer,
        qhelpTmpDir,
        selectedQuery,
      ),
  };
}

async function previewQueryHelp(
  commandManager: AppCommandManager,
  cliServer: CodeQLCliServer,
  qhelpTmpDir: string,
  selectedQuery: Uri,
): Promise<void> {
  // selectedQuery is unpopulated when executing through the command palette
  const pathToQhelp = selectedQuery
    ? selectedQuery.fsPath
    : window.activeTextEditor?.document.uri.fsPath;
  if (pathToQhelp) {
    // Create temporary directory
    const relativePathToMd = `${basename(pathToQhelp, ".qhelp")}.md`;
    const absolutePathToMd = join(qhelpTmpDir, relativePathToMd);
    const uri = Uri.file(absolutePathToMd);
    try {
      await cliServer.generateQueryHelp(pathToQhelp, absolutePathToMd);
      // Open and then close the raw markdown file first. This ensures that the preview
      // is refreshed when we open it in the next step.
      // This will mean that the users will see a the raw markdown file for a brief moment,
      // but this is the best we can do for now to ensure that the preview is refreshed.
      await window.showTextDocument(uri, {
        viewColumn: ViewColumn.Active,
      });
      await commandManager.execute("workbench.action.closeActiveEditor");

      // Now open the preview
      await commandManager.execute("markdown.showPreviewToSide", uri);
    } catch (e) {
      const errorMessage = getErrorMessage(e).includes(
        "Generating qhelp in markdown",
      )
        ? redactableError`Could not generate markdown from ${pathToQhelp}: Bad formatting in .qhelp file.`
        : redactableError`Could not open a preview of the generated file (${absolutePathToMd}).`;
      void showAndLogExceptionWithTelemetry(
        extLogger,
        telemetryListener,
        errorMessage,
        {
          fullMessage: `${errorMessage}\n${getErrorMessage(e)}`,
        },
      );
    }
  }
}

async function openReferencedFile(
  qs: QueryRunner,
  cliServer: CodeQLCliServer,
  selectedQuery: Uri,
): Promise<void> {
  // If no file is selected, the path of the file in the editor is selected
  const path =
    selectedQuery?.fsPath || window.activeTextEditor?.document.uri.fsPath;
  if (qs !== undefined && path) {
    const resolved = await cliServer.resolveQlref(path);
    const uri = Uri.file(resolved.resolvedPath);
    await window.showTextDocument(uri, { preview: false });
  }
}
