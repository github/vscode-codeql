import { FromCompareViewMessage, FromRemoteQueriesMessage, FromResultsViewMsg } from '../pure/interface-types';

export interface VsCodeApi {
  /**
   * Post message back to vscode extension.
   */
  postMessage(msg: FromResultsViewMsg | FromCompareViewMessage | FromRemoteQueriesMessage): void;
}

declare const acquireVsCodeApi: () => VsCodeApi;
export const vscode = acquireVsCodeApi();
