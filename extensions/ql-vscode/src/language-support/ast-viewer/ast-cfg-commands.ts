import type { Uri } from "vscode";
import { window } from "vscode";
import { withProgress } from "../../common/vscode/progress";
import type { AstViewer } from "./ast-viewer";
import type { AstCfgCommands } from "../../common/commands";
import type { LocalQueries } from "../../local-queries";
import { QuickEvalType } from "../../local-queries";
import type {
  TemplatePrintAstProvider,
  TemplatePrintCfgProvider,
} from "../contextual/template-provider";

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
        const editor = window.activeTextEditor;
        const res = !editor
          ? undefined
          : await cfgTemplateProvider.provideCfgUri(
              editor.document,
              editor.selection.active.line + 1,
              editor.selection.active.character + 1,
            );
        if (res) {
          await localQueries.compileAndRunQuery(
            QuickEvalType.None,
            res[0],
            progress,
            token,
            undefined,
            undefined,
            res[1],
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
