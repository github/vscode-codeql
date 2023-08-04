import {
  FromCompareViewMessage,
  FromDataExtensionsEditorMessage,
  FromResultsViewMsg,
  FromVariantAnalysisMessage,
  VariantAnalysisState,
} from "../common/interface-types";

interface VsCodeApi {
  /**
   * Post message back to vscode extension.
   */
  postMessage(
    msg:
      | FromResultsViewMsg
      | FromCompareViewMessage
      | FromVariantAnalysisMessage
      | FromDataExtensionsEditorMessage,
  ): void;

  /**
   * Set state of the webview.
   */
  setState(state: VariantAnalysisState): void;
}

declare const acquireVsCodeApi: () => VsCodeApi;
export const vscode = acquireVsCodeApi();
