import type {
  FromCompareViewMessage,
  FromMethodModelingMessage,
  FromModelAlertsMessage,
  FromModelEditorMessage,
  FromResultsViewMsg,
  FromVariantAnalysisMessage,
  VariantAnalysisState,
} from "../common/interface-types";

export interface VsCodeApi {
  /**
   * Post message back to vscode extension.
   */
  postMessage(
    msg:
      | FromResultsViewMsg
      | FromCompareViewMessage
      | FromVariantAnalysisMessage
      | FromModelEditorMessage
      | FromMethodModelingMessage
      | FromModelAlertsMessage,
  ): void;

  /**
   * Set state of the webview.
   */
  setState(state: VariantAnalysisState): void;
}

declare const acquireVsCodeApi: () => VsCodeApi;
export const vscode = acquireVsCodeApi();
