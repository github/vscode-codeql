import {
  FromCompareViewMessage,
  FromDataExtensionsEditorMessage,
  FromPerformanceEditorViewMsg,
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
      | FromDataExtensionsEditorMessage
      | FromPerformanceEditorViewMsg,
  ): void;

  /**
   * Set state of the webview.
   */
  setState(state: VariantAnalysisState): void;
}

declare const acquireVsCodeApi: () => VsCodeApi;
export const vscode = acquireVsCodeApi();
