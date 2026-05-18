import type { QuickPickItem, Uri } from "vscode";
import { FileType, window, workspace } from "vscode";
import type { DatabaseItem } from "./local-databases";
import {
  encodeSourceArchiveUri,
  decodeSourceArchiveUri,
} from "../common/vscode/archive-filesystem-provider";

interface SourceArchiveFileQuickPickItem extends QuickPickItem {
  uri: Uri;
}

/**
 * Recursively collects all file URIs from a source archive directory.
 */
async function collectFiles(
  dirUri: Uri,
  sourceArchiveZipPath: string,
  prefix: string,
  items: SourceArchiveFileQuickPickItem[] = [],
): Promise<SourceArchiveFileQuickPickItem[]> {
  const entries = await workspace.fs.readDirectory(dirUri);

  for (const [name, type] of entries) {
    const childPath = prefix ? `${prefix}/${name}` : name;
    const childUri = encodeSourceArchiveUri({
      sourceArchiveZipPath,
      pathWithinSourceArchive: `${decodeSourceArchiveUri(dirUri).pathWithinSourceArchive}/${name}`,
    });

    if (type === FileType.File) {
      items.push({
        label: name,
        description: prefix,
        uri: childUri,
      });
    } else if (type === FileType.Directory) {
      await collectFiles(childUri, sourceArchiveZipPath, childPath, items);
    }
  }

  return items;
}

/**
 * Shows a Quick Pick to search for and open a file from the source archive
 * of the given database.
 */
export async function searchSourceArchiveFiles(
  databaseItem: DatabaseItem,
): Promise<void> {
  let explorerUri: Uri;
  try {
    explorerUri = databaseItem.getSourceArchiveExplorerUri();
  } catch (e) {
    void window.showErrorMessage(e instanceof Error ? e.message : String(e));
    return;
  }
  const sourceArchiveZipPath =
    decodeSourceArchiveUri(explorerUri).sourceArchiveZipPath;

  const filesPromise = collectFiles(explorerUri, sourceArchiveZipPath, "");

  const quickPick = window.createQuickPick<SourceArchiveFileQuickPickItem>();
  quickPick.placeholder = "Go to File in Selected Database...";
  quickPick.matchOnDescription = true;
  quickPick.busy = true;
  quickPick.show();

  try {
    const items = await filesPromise;
    // Sort items by file name, then by path
    items.sort((a, b) => {
      const nameCmp = a.label.localeCompare(b.label);
      if (nameCmp !== 0) {
        return nameCmp;
      }
      return (a.description ?? "").localeCompare(b.description ?? "");
    });
    quickPick.items = items;
    quickPick.busy = false;
  } catch (e) {
    quickPick.dispose();
    void window.showErrorMessage(
      `Failed to read source archive: ${e instanceof Error ? e.message : String(e)}`,
    );
    return;
  }

  return new Promise<void>((resolve) => {
    quickPick.onDidAccept(async () => {
      const selected = quickPick.selectedItems[0];
      quickPick.dispose();
      try {
        if (selected) {
          const doc = await workspace.openTextDocument(selected.uri);
          await window.showTextDocument(doc);
        }
      } catch (e) {
        void window.showErrorMessage(
          `Failed to open source archive file: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        resolve();
      }
    });

    quickPick.onDidHide(() => {
      quickPick.dispose();
      resolve();
    });
  });
}
