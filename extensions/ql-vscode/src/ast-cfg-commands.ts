import { Uri, window } from "vscode";
import { withProgress } from "./progress";
import { AstViewer } from "./astViewer";
import {
  TemplatePrintAstProvider,
  TemplatePrintCfgProvider,
} from "./language-support";
import { AstCfgCommands } from "./common/commands";
import { LocalQueries } from "./local-queries";

type AstCfgOptions = {
  localQueries: LocalQueries;
  astViewer: AstViewer;
  astTemplateProvider: TemplatePrintAstProvider;
  cfgTemplateProvider: TemplatePrintCfgProvider;
};

export function getAstCfgCommands({
  localQueries,
  astViewer,
  astTemplateProvider,
  cfgTemplateProvider,
}: AstCfgOptions): AstCfgCommands {
  const viewAst = async (selectedFile: Uri) =>
    withProgress(
      async (progress, token) => {
        const ast = await astTemplateProvider.provideAst(
          progress,
          token,
          selectedFile ?? window.activeTextEditor?.document.uri,
        );
        if (ast) {
          astViewer.updateRoots(await ast.getRoots(), ast.db, ast.fileName);
        }
      },
      {
        cancellable: true,
        title: "Calculate AST",
      },
    );

  const viewCfg = async () =>
    withProgress(
      async (progress, token) => {
        const res = await cfgTemplateProvider.provideCfgUri(
          window.activeTextEditor?.document,
        );
        if (res) {
          await localQueries.compileAndRunQuery(
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
    "codeQL.viewAst": viewAst,
    "codeQL.viewAstContextExplorer": viewAst,
    "codeQL.viewAstContextEditor": viewAst,
    "codeQL.viewCfg": viewCfg,
    "codeQL.viewCfgContextExplorer": viewCfg,
    "codeQL.viewCfgContextEditor": viewCfg,
  };
}
