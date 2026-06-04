import type { QuickPickItem, Uri } from "vscode";
import { window, workspace } from "vscode";
import type { DatabaseItem } from "./local-databases";

interface SourceArchiveFileQuickPickItem extends QuickPickItem {
  uri: Uri;
}

/**
 * Shows a Quick Pick to search for and open a file from the source archive
 * of the given database.
 */
export async function searchSourceArchiveFiles(
  databaseItem: DatabaseItem,
): Promise<void> {
  const filesPromise = databaseItem.getSourceArchiveFiles();

  const quickPick = window.createQuickPick<SourceArchiveFileQuickPickItem>();
  quickPick.placeholder = "Go to File in Selected Database...";
  quickPick.matchOnDescription = true;
  quickPick.busy = true;
  quickPick.show();

  try {
    const files = await filesPromise;
    quickPick.items = files.map((f) => ({
      label: f.name,
      description: f.path,
      uri: f.uri,
    }));
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
