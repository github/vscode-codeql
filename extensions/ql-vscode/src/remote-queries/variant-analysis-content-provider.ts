import { TextDocumentContentProvider, Uri } from "vscode";
import { URLSearchParams } from "url";
import { showAndLogWarningMessage } from "../helpers";
import { SHOW_QUERY_TEXT_MSG } from "../query-history/query-history";
import { VariantAnalysisManager } from "./variant-analysis-manager";

export const createVariantAnalysisContentProvider = (
  variantAnalysisManager: VariantAnalysisManager,
): TextDocumentContentProvider => ({
  async provideTextDocumentContent(uri: Uri): Promise<string | undefined> {
    const params = new URLSearchParams(uri.query);

    const variantAnalysisIdString = params.get("variantAnalysisId");
    if (!variantAnalysisIdString) {
      void showAndLogWarningMessage(
        "Unable to show query text. No variant analysis ID provided.",
      );
      return undefined;
    }
    const variantAnalysisId = parseInt(variantAnalysisIdString);

    const variantAnalysis = await variantAnalysisManager.getVariantAnalysis(
      variantAnalysisId,
    );
    if (!variantAnalysis) {
      void showAndLogWarningMessage(
        "Unable to show query text. No variant analysis found.",
      );
      return undefined;
    }

    return SHOW_QUERY_TEXT_MSG + variantAnalysis.query.text;
  },
});
