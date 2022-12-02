import {
  CancellationToken,
  FileDecoration,
  FileDecorationProvider,
  ProviderResult,
  Uri,
} from "vscode";

export class DbSelectionDecorationProvider implements FileDecorationProvider {
  provideFileDecoration(
    uri: Uri,
    _token: CancellationToken,
  ): ProviderResult<FileDecoration> {
    if (uri?.query === "selected=true") {
      return {
        badge: "✔",
      };
    }

    return undefined;
  }
}
