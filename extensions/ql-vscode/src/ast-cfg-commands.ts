import { CancellationToken, ExtensionContext, Uri, window } from "vscode";
import { commandRunnerWithProgress, ProgressCallback } from "./commandRunner";
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
  const viewAstCommand = async (
    progress: ProgressCallback,
    token: CancellationToken,
    selectedFile: Uri,
  ) =>
    await viewAst(
      astViewer,
      astTemplateProvider,
      progress,
      token,
      selectedFile,
    );

  const viewCfgCommand = async (
    progress: ProgressCallback,
    token: CancellationToken,
  ) => {
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
  };

  ctx.subscriptions.push(
    commandRunnerWithProgress("codeQL.viewAst", viewAstCommand, {
      cancellable: true,
      title: "Calculate AST",
    }),
  );

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.viewAst" command
  ctx.subscriptions.push(
    commandRunnerWithProgress("codeQL.viewAstContextExplorer", viewAstCommand, {
      cancellable: true,
      title: "Calculate AST",
    }),
  );

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.viewAst" command
  ctx.subscriptions.push(
    commandRunnerWithProgress("codeQL.viewAstContextEditor", viewAstCommand, {
      cancellable: true,
      title: "Calculate AST",
    }),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress("codeQL.viewCfg", viewCfgCommand, {
      title: "Calculating Control Flow Graph",
      cancellable: true,
    }),
  );

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.viewCfg" command
  ctx.subscriptions.push(
    commandRunnerWithProgress("codeQL.viewCfgContextExplorer", viewCfgCommand, {
      title: "Calculating Control Flow Graph",
      cancellable: true,
    }),
  );

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.viewCfg" command
  ctx.subscriptions.push(
    commandRunnerWithProgress("codeQL.viewCfgContextEditor", viewCfgCommand, {
      title: "Calculating Control Flow Graph",
      cancellable: true,
    }),
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
