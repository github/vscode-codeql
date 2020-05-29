import * as crypto from "crypto";
import { Uri, Location, Range, WebviewPanel, Webview, window as Window, workspace, ViewColumn, Selection, TextEditorRevealType, ThemeColor } from "vscode";
import {
  FivePartLocation,
  LocationStyle,
  LocationValue,
  tryGetResolvableLocation,
  WholeFileLocation,
  ResolvableLocationValue,
} from "semmle-bqrs";
import { DatabaseItem } from "./databases";

/** Gets a nonce string created with 128 bits of entropy. */
export function getNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}

/**
 * Whether to force webview to reveal
 */
export enum WebviewReveal {
  Forced,
  NotForced,
}

/** Converts a filesystem URI into a webview URI string that the given panel can use to read the file. */
export function fileUriToWebviewUri(
  panel: WebviewPanel,
  fileUriOnDisk: Uri
): string {
  return panel.webview.asWebviewUri(fileUriOnDisk).toString();
}

/** Converts a URI string received from a webview into a local filesystem URI for the same resource. */
export function webviewUriToFileUri(webviewUri: string): Uri {
  // Webview URIs used the vscode-resource scheme. The filesystem path of the resource can be obtained from the path component of the webview URI.
  const path = Uri.parse(webviewUri).path;
  // For this path to be interpreted on the filesystem, we need to parse it as a filesystem URI for the current platform.
  return Uri.file(path);
}

/**
 * Resolves the specified CodeQL location to a URI into the source archive.
 * @param loc CodeQL location to resolve. Must have a non-empty value for `loc.file`.
 * @param databaseItem Database in which to resolve the file location.
 */
export function resolveFivePartLocation(
  loc: FivePartLocation,
  databaseItem: DatabaseItem
): Location {
  // `Range` is a half-open interval, and is zero-based. CodeQL locations are closed intervals, and
  // are one-based. Adjust accordingly.
  const range = new Range(
    Math.max(0, loc.lineStart - 1),
    Math.max(0, loc.colStart - 1),
    Math.max(0, loc.lineEnd - 1),
    Math.max(0, loc.colEnd)
  );

  return new Location(databaseItem.resolveSourceFile(loc.file), range);
}

/**
 * Resolves the specified CodeQL filesystem resource location to a URI into the source archive.
 * @param loc CodeQL location to resolve, corresponding to an entire filesystem resource. Must have a non-empty value for `loc.file`.
 * @param databaseItem Database in which to resolve the filesystem resource location.
 */
export function resolveWholeFileLocation(
  loc: WholeFileLocation,
  databaseItem: DatabaseItem
): Location {
  // A location corresponding to the start of the file.
  const range = new Range(0, 0, 0, 0);
  return new Location(databaseItem.resolveSourceFile(loc.file), range);
}

/**
 * Try to resolve the specified CodeQL location to a URI into the source archive. If no exact location
 * can be resolved, returns `undefined`.
 * @param loc CodeQL location to resolve
 * @param databaseItem Database in which to resolve the file location.
 */
export function tryResolveLocation(
  loc: LocationValue | undefined,
  databaseItem: DatabaseItem
): Location | undefined {
  const resolvableLoc = tryGetResolvableLocation(loc);
  if (resolvableLoc === undefined) {
    return undefined;
  }
  switch (resolvableLoc.t) {
    case LocationStyle.FivePart:
      return resolveFivePartLocation(resolvableLoc, databaseItem);
    case LocationStyle.WholeFile:
      return resolveWholeFileLocation(resolvableLoc, databaseItem);
    default:
      return undefined;
  }
}

/**
 * Returns HTML to populate the given webview.
 * Uses a content security policy that only loads the given script.
 */
export function getHtmlForWebview(
  webview: Webview,
  scriptUriOnDisk: Uri,
  stylesheetUriOnDisk: Uri
): string {
  // Convert the on-disk URIs into webview URIs.
  const scriptWebviewUri = webview.asWebviewUri(scriptUriOnDisk);
  const stylesheetWebviewUri = webview.asWebviewUri(stylesheetUriOnDisk);
  // Use a nonce in the content security policy to uniquely identify the above resources.
  const nonce = getNonce();
  /*
   * Content security policy:
   * default-src: allow nothing by default.
   * script-src: allow only the given script, using the nonce.
   * style-src: allow only the given stylesheet, using the nonce.
   * connect-src: only allow fetch calls to webview resource URIs
   * (this is used to load BQRS result files).
   */
  return `
<html>
  <head>
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src ${webview.cspSource};">
    <link nonce="${nonce}" rel="stylesheet" href="${stylesheetWebviewUri}">
  </head>
  <body>
    <div id=root>
    </div>
      <script nonce="${nonce}" src="${scriptWebviewUri}">
    </script>
  </body>
</html>`;
}


const findMatchBackground = new ThemeColor("editor.findMatchBackground");
const findRangeHighlightBackground = new ThemeColor(
  "editor.findRangeHighlightBackground"
);

export const shownLocationDecoration = Window.createTextEditorDecorationType(
  {
    backgroundColor: findMatchBackground,
  }
);

export const shownLocationLineDecoration = Window.createTextEditorDecorationType(
  {
    backgroundColor: findRangeHighlightBackground,
    isWholeLine: true,
  }
);

export async function showLocation(
  loc: ResolvableLocationValue,
  databaseItem: DatabaseItem
): Promise<void> {
  const resolvedLocation = tryResolveLocation(loc, databaseItem);
  if (resolvedLocation) {
    const doc = await workspace.openTextDocument(resolvedLocation.uri);
    const editorsWithDoc = Window.visibleTextEditors.filter(
      (e) => e.document === doc
    );
    const editor =
      editorsWithDoc.length > 0
        ? editorsWithDoc[0]
        : await Window.showTextDocument(doc, ViewColumn.One);
    const range = resolvedLocation.range;
    // When highlighting the range, vscode's occurrence-match and bracket-match highlighting will
    // trigger based on where we place the cursor/selection, and will compete for the user's attention.
    // For reference:
    // - Occurences are highlighted when the cursor is next to or inside a word or a whole word is selected.
    // - Brackets are highlighted when the cursor is next to a bracket and there is an empty selection.
    // - Multi-line selections explicitly highlight line-break characters, but multi-line decorators do not.
    //
    // For single-line ranges, select the whole range, mainly to disable bracket highlighting.
    // For multi-line ranges, place the cursor at the beginning to avoid visual artifacts from selected line-breaks.
    // Multi-line ranges are usually large enough to overshadow the noise from bracket highlighting.
    const selectionEnd =
      range.start.line === range.end.line ? range.end : range.start;
    editor.selection = new Selection(range.start, selectionEnd);
    editor.revealRange(range, TextEditorRevealType.InCenter);
    editor.setDecorations(shownLocationDecoration, [range]);
    editor.setDecorations(shownLocationLineDecoration, [range]);
  }
}
