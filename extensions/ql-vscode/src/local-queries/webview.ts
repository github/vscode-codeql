import type { Uri, WebviewPanel } from "vscode";

/**
 * Whether to force webview to reveal
 */
export enum WebviewReveal {
  Forced,
  NotForced,
}

/**
 * Converts a filesystem URI into a webview URI string that the given panel
 * can use to read the file.
 */
export function fileUriToWebviewUri(
  panel: WebviewPanel,
  fileUriOnDisk: Uri,
): string {
  return panel.webview.asWebviewUri(fileUriOnDisk).toString();
}
