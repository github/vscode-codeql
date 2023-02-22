import {
  FromCompareViewMessage,
  FromExternalApiMessage,
  FromResultsViewMsg,
  FromVariantAnalysisMessage,
  VariantAnalysisState,
} from "../pure/interface-types";

export interface VsCodeApi {
  /**
   * Post message back to vscode extension.
   */
  postMessage(
    msg:
      | FromResultsViewMsg
      | FromCompareViewMessage
      | FromVariantAnalysisMessage
      | FromExternalApiMessage,
  ): void;

  /**
   * Set state of the webview.
   */
  setState(state: VariantAnalysisState): void;
}

declare const acquireVsCodeApi: () => VsCodeApi;
export const vscode = acquireVsCodeApi();
