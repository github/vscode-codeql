import type { TextDocumentContentProvider, Uri } from "vscode";
import { URLSearchParams } from "url";
import { SHOW_QUERY_TEXT_MSG } from "../query-history/query-history-manager";
import type { VariantAnalysisManager } from "./variant-analysis-manager";
import { showAndLogWarningMessage } from "../common/logging";
import { extLogger } from "../common/logging/vscode";

export const createVariantAnalysisContentProvider = (
  variantAnalysisManager: VariantAnalysisManager,
): TextDocumentContentProvider => ({
  async provideTextDocumentContent(uri: Uri): Promise<string | undefined> {
    const params = new URLSearchParams(uri.query);

    const variantAnalysisIdString = params.get("variantAnalysisId");
    if (!variantAnalysisIdString) {
      void showAndLogWarningMessage(
        extLogger,
        "Unable to show query text. No variant analysis ID provided.",
      );
      return undefined;
    }
    const variantAnalysisId = parseInt(variantAnalysisIdString);

    const variantAnalysis =
      variantAnalysisManager.tryGetVariantAnalysis(variantAnalysisId);
    if (!variantAnalysis) {
      void showAndLogWarningMessage(
        extLogger,
        "Unable to show query text. No variant analysis found.",
      );
      return undefined;
    }

    return SHOW_QUERY_TEXT_MSG + variantAnalysis.query.text;
  },
});
