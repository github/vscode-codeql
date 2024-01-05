import type {
  CancellationToken,
  FileDecoration,
  FileDecorationProvider,
  ProviderResult,
  Uri,
} from "vscode";
import { SELECTED_DB_ITEM_RESOURCE_URI } from "./db-tree-view-item";

export class DbSelectionDecorationProvider implements FileDecorationProvider {
  provideFileDecoration(
    uri: Uri,
    _token: CancellationToken,
  ): ProviderResult<FileDecoration> {
    if (uri.toString(true) === SELECTED_DB_ITEM_RESOURCE_URI) {
      return {
        badge: "✓",
        tooltip: "Currently selected",
      };
    }

    return undefined;
  }
}
