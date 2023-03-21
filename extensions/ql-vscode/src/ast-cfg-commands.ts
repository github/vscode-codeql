import { CancellationToken, Uri, window } from "vscode";
import { ProgressCallback, withProgress } from "./commandRunner";
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
import { AstCfgCommands } from "./common/commands";

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

export function getAstCfgCommands({
  queryRunner,
  queryHistoryManager,
  databaseUI,
  localQueryResultsView,
  queryStorageDir,
  astViewer,
  astTemplateProvider,
  cfgTemplateProvider,
}: AstCfgOptions): AstCfgCommands {
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

  return {
    "codeQL.viewAst": viewAstCommand,
    "codeQL.viewAstContextExplorer": viewAstCommand,
    "codeQL.viewAstContextEditor": viewAstCommand,
    "codeQL.viewCfg": viewCfgCommand,
    "codeQL.viewCfgContextExplorer": viewCfgCommand,
    "codeQL.viewCfgContextEditor": viewCfgCommand,
  };
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
