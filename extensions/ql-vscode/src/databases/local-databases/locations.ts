import {
  Location,
  Range,
  Selection,
  TextEditorRevealType,
  ThemeColor,
  Uri,
  ViewColumn,
  window as Window,
  workspace,
} from "vscode";
import {
  LineColumnLocation,
  ResolvableLocationValue,
  UrlValue,
  WholeFileLocation,
} from "../../common/bqrs-cli-types";
import {
  isLineColumnLoc,
  tryGetResolvableLocation,
} from "../../common/bqrs-utils";
import { getErrorMessage } from "../../common/helpers-pure";
import { Logger } from "../../common/logging";
import { DatabaseItem } from "./database-item";
import { DatabaseManager } from "./database-manager";

const findMatchBackground = new ThemeColor("editor.findMatchBackground");
const findRangeHighlightBackground = new ThemeColor(
  "editor.findRangeHighlightBackground",
);

export const shownLocationDecoration = Window.createTextEditorDecorationType({
  backgroundColor: findMatchBackground,
});

export const shownLocationLineDecoration =
  Window.createTextEditorDecorationType({
    backgroundColor: findRangeHighlightBackground,
    isWholeLine: true,
  });

/**
 * Resolves the specified CodeQL location to a URI into the source archive.
 * @param loc CodeQL location to resolve. Must have a non-empty value for `loc.file`.
 * @param databaseItem Database in which to resolve the file location.
 */
function resolveFivePartLocation(
  loc: LineColumnLocation,
  databaseItem: DatabaseItem,
): Location {
  // `Range` is a half-open interval, and is zero-based. CodeQL locations are closed intervals, and
  // are one-based. Adjust accordingly.
  const range = new Range(
    Math.max(0, loc.startLine - 1),
    Math.max(0, loc.startColumn - 1),
    Math.max(0, loc.endLine - 1),
    Math.max(1, loc.endColumn),
  );

  return new Location(databaseItem.resolveSourceFile(loc.uri), range);
}

/**
 * Resolves the specified CodeQL filesystem resource location to a URI into the source archive.
 * @param loc CodeQL location to resolve, corresponding to an entire filesystem resource. Must have a non-empty value for `loc.file`.
 * @param databaseItem Database in which to resolve the filesystem resource location.
 */
function resolveWholeFileLocation(
  loc: WholeFileLocation,
  databaseItem: DatabaseItem,
): Location {
  // A location corresponding to the start of the file.
  const range = new Range(0, 0, 0, 0);
  return new Location(databaseItem.resolveSourceFile(loc.uri), range);
}

/**
 * Try to resolve the specified CodeQL location to a URI into the source archive. If no exact location
 * can be resolved, returns `undefined`.
 * @param loc CodeQL location to resolve
 * @param databaseItem Database in which to resolve the file location.
 */
export function tryResolveLocation(
  loc: UrlValue | undefined,
  databaseItem: DatabaseItem,
): Location | undefined {
  const resolvableLoc = tryGetResolvableLocation(loc);
  if (!resolvableLoc || typeof resolvableLoc === "string") {
    return;
  } else if (isLineColumnLoc(resolvableLoc)) {
    return resolveFivePartLocation(resolvableLoc, databaseItem);
  } else {
    return resolveWholeFileLocation(resolvableLoc, databaseItem);
  }
}

export async function showResolvableLocation(
  loc: ResolvableLocationValue,
  databaseItem: DatabaseItem,
  logger: Logger,
): Promise<void> {
  try {
    await showLocation(tryResolveLocation(loc, databaseItem));
  } catch (e) {
    if (e instanceof Error && e.message.match(/File not found/)) {
      void Window.showErrorMessage(
        "Original file of this result is not in the database's source archive.",
      );
    } else {
      void logger.log(`Unable to jump to location: ${getErrorMessage(e)}`);
    }
  }
}

export async function showLocation(location?: Location) {
  if (!location) {
    return;
  }

  const doc = await workspace.openTextDocument(location.uri);
  const editorsWithDoc = Window.visibleTextEditors.filter(
    (e) => e.document === doc,
  );
  const editor =
    editorsWithDoc.length > 0
      ? editorsWithDoc[0]
      : await Window.showTextDocument(doc, {
          // avoid preview mode so editor is sticky and will be added to navigation and search histories.
          preview: false,
          viewColumn: ViewColumn.One,
        });

  const range = location.range;
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

export async function jumpToLocation(
  databaseUri: string,
  loc: ResolvableLocationValue,
  databaseManager: DatabaseManager,
  logger: Logger,
) {
  const databaseItem = databaseManager.findDatabaseItem(Uri.parse(databaseUri));
  if (databaseItem !== undefined) {
    await showResolvableLocation(loc, databaseItem, logger);
  }
}
