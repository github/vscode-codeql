import { FromCompareViewMessage, FromResultsViewMsg } from '../pure/interface-types';

export interface VsCodeApi {
  /**
   * Post message back to vscode extension.
   */
  postMessage(msg: FromResultsViewMsg | FromCompareViewMessage): void;
}

declare const acquireVsCodeApi: () => VsCodeApi;
export const vscode = acquireVsCodeApi();
