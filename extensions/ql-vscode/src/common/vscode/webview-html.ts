import type { Webview } from "vscode";
import { Uri } from "vscode";
import { randomBytes } from "crypto";
import { EOL } from "os";
import type { App } from "../app";

export type WebviewKind =
  | "results"
  | "compare"
  | "variant-analysis"
  | "data-flow-paths"
  | "model-editor"
  | "method-modeling"
  | "model-alerts";

export interface WebviewMessage {
  t: string;
}

/**
 * Returns HTML to populate the given webview.
 * Uses a content security policy that only loads the given script.
 */
export function getHtmlForWebview(
  app: App,
  webview: Webview,
  view: WebviewKind,
  {
    allowInlineStyles,
    allowWasmEval,
  }: {
    allowInlineStyles?: boolean;
    allowWasmEval?: boolean;
  } = {
    allowInlineStyles: false,
    allowWasmEval: false,
  },
): string {
  const scriptUriOnDisk = Uri.joinPath(
    Uri.file(app.extensionPath),
    "out/webview.js",
  );

  const stylesheetUrisOnDisk = [
    Uri.joinPath(Uri.file(app.extensionPath), "out/webview.css"),
  ];

  // Convert the on-disk URIs into webview URIs.
  const scriptWebviewUri = webview.asWebviewUri(scriptUriOnDisk);
  const stylesheetWebviewUris = stylesheetUrisOnDisk.map(
    (stylesheetUriOnDisk) => webview.asWebviewUri(stylesheetUriOnDisk),
  );

  // Use a nonce in the content security policy to uniquely identify the above resources.
  const nonce = getNonce();

  const stylesheetsHtmlLines = allowInlineStyles
    ? stylesheetWebviewUris.map((uri) => createStylesLinkWithoutNonce(uri))
    : stylesheetWebviewUris.map((uri) => createStylesLinkWithNonce(nonce, uri));

  const styleSrc = allowInlineStyles
    ? `${webview.cspSource} vscode-file: 'unsafe-inline'`
    : `'nonce-${nonce}'`;

  const fontSrc = webview.cspSource;

  /*
   * Content security policy:
   * default-src: allow nothing by default.
   * script-src:
   *   - allow the given script, using the nonce.
   *   - 'wasm-unsafe-eval: allow loading WebAssembly modules if necessary.
   * style-src: allow only the given stylesheet, using the nonce.
   * connect-src: only allow fetch calls to webview resource URIs
   * (this is used to load BQRS result files).
   */
  return `
<html>
  <head>
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'${
            allowWasmEval ? " 'wasm-unsafe-eval'" : ""
          }; font-src ${fontSrc}; style-src ${styleSrc}; connect-src ${
            webview.cspSource
          };">
        ${stylesheetsHtmlLines.join(`    ${EOL}`)}
  </head>
  <body>
    <div id=root data-view="${view}">
    </div>
      <script nonce="${nonce}" src="${scriptWebviewUri}">
    </script>
  </body>
</html>`;
}

/** Gets a nonce string created with 128 bits of entropy. */
function getNonce(): string {
  return randomBytes(16).toString("base64");
}

function createStylesLinkWithNonce(nonce: string, uri: Uri): string {
  return `<link nonce="${nonce}" rel="stylesheet" href="${uri}">`;
}

function createStylesLinkWithoutNonce(uri: Uri): string {
  return `<link rel="stylesheet" href="${uri}">`;
}
