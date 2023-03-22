import { commands, ExtensionContext, Uri, window } from "vscode";
import { CodeQLCliServer } from "./cli";
import { QueryRunner } from "./queryRunner";
import { commandRunner } from "./commandRunner";
import { basename, join } from "path";
import { getErrorMessage } from "./pure/helpers-pure";
import { redactableError } from "./pure/errors";
import { showAndLogExceptionWithTelemetry } from "./helpers";

type QueryEditorOptions = {
  queryRunner: QueryRunner;
  cliServer: CodeQLCliServer;

  qhelpTmpDir: string;
};

export function registerQueryEditorCommands(
  ctx: ExtensionContext,
  { queryRunner, cliServer, qhelpTmpDir }: QueryEditorOptions,
) {
  ctx.subscriptions.push(
    commandRunner("codeQL.openReferencedFile", async (selectedQuery: Uri) => {
      await openReferencedFile(queryRunner, cliServer, selectedQuery);
    }),
  );

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.openReferencedFile" command
  ctx.subscriptions.push(
    commandRunner(
      "codeQL.openReferencedFileContextEditor",
      async (selectedQuery: Uri) => {
        await openReferencedFile(queryRunner, cliServer, selectedQuery);
      },
    ),
  );

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.openReferencedFile" command
  ctx.subscriptions.push(
    commandRunner(
      "codeQL.openReferencedFileContextExplorer",
      async (selectedQuery: Uri) => {
        await openReferencedFile(queryRunner, cliServer, selectedQuery);
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner("codeQL.previewQueryHelp", async (selectedQuery: Uri) => {
      await previewQueryHelp(cliServer, qhelpTmpDir, selectedQuery);
    }),
  );
}

async function previewQueryHelp(
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
      await commands.executeCommand("markdown.showPreviewToSide", uri);
    } catch (e) {
      const errorMessage = getErrorMessage(e).includes(
        "Generating qhelp in markdown",
      )
        ? redactableError`Could not generate markdown from ${pathToQhelp}: Bad formatting in .qhelp file.`
        : redactableError`Could not open a preview of the generated file (${absolutePathToMd}).`;
      void showAndLogExceptionWithTelemetry(errorMessage, {
        fullMessage: `${errorMessage}\n${getErrorMessage(e)}`,
      });
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
