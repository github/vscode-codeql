import { CancellationToken, ExtensionContext, Uri, window } from "vscode";
import { commandRunner, ProgressCallback, withProgress } from "./commandRunner";
import { AstViewer } from "./astViewer";
import {
  TemplatePrintAstProvider,
  TemplatePrintCfgProvider,
} from "./contextual/templateProvider";
import { compileAndRunQuery } from "./local-queries";
import { QueryRunner } from "./queryRunner";
import { QueryHistoryManager } from "./query-history/query-history-manager";
import { DatabaseUI } from "./local-databases-ui";
import { ResultsView } from "./interface";

type AstCfgOptions = {
  queryRunner: QueryRunner;
  queryHistoryManager: QueryHistoryManager;
  databaseUI: DatabaseUI;
  localQueryResultsView: ResultsView;
  queryStorageDir: string;

  astViewer: AstViewer;
  astTemplateProvider: TemplatePrintAstProvider;
  cfgTemplateProvider: TemplatePrintCfgProvider;
};

export function registerAstCfgCommands(
  ctx: ExtensionContext,
  {
    queryRunner,
    queryHistoryManager,
    databaseUI,
    localQueryResultsView,
    queryStorageDir,
    astViewer,
    astTemplateProvider,
    cfgTemplateProvider,
  }: AstCfgOptions,
) {
  const viewAstCommand = async (selectedFile: Uri) =>
    withProgress(
      async (progress, token) =>
        await viewAst(
          astViewer,
          astTemplateProvider,
          progress,
          token,
          selectedFile,
        ),
      {
        cancellable: true,
        title: "Calculate AST",
      },
    );

  const viewCfgCommand = async () =>
    withProgress(
      async (progress, token) => {
        const res = await cfgTemplateProvider.provideCfgUri(
          window.activeTextEditor?.document,
        );
        if (res) {
          await compileAndRunQuery(
            queryRunner,
            queryHistoryManager,
            databaseUI,
            localQueryResultsView,
            queryStorageDir,
            false,
            res[0],
            progress,
            token,
            undefined,
          );
        }
      },
      {
        title: "Calculating Control Flow Graph",
        cancellable: true,
      },
    );

  ctx.subscriptions.push(commandRunner("codeQL.viewAst", viewAstCommand));

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.viewAst" command
  ctx.subscriptions.push(
    commandRunner("codeQL.viewAstContextExplorer", viewAstCommand),
  );

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.viewAst" command
  ctx.subscriptions.push(
    commandRunner("codeQL.viewAstContextEditor", viewAstCommand),
  );

  ctx.subscriptions.push(commandRunner("codeQL.viewCfg", viewCfgCommand));

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.viewCfg" command
  ctx.subscriptions.push(
    commandRunner("codeQL.viewCfgContextExplorer", viewCfgCommand),
  );

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.viewCfg" command
  ctx.subscriptions.push(
    commandRunner("codeQL.viewCfgContextEditor", viewCfgCommand),
  );
}

async function viewAst(
  astViewer: AstViewer,
  printAstTemplateProvider: TemplatePrintAstProvider,
  progress: ProgressCallback,
  token: CancellationToken,
  selectedFile: Uri,
): Promise<void> {
  const ast = await printAstTemplateProvider.provideAst(
    progress,
    token,
    selectedFile ?? window.activeTextEditor?.document.uri,
  );
  if (ast) {
    astViewer.updateRoots(await ast.getRoots(), ast.db, ast.fileName);
  }
}
