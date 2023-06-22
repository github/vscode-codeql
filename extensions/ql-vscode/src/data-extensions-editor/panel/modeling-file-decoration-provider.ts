import {
  FileDecoration,
  FileDecorationProvider,
  ProviderResult,
  Uri,
} from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import { ExternalApiUsageProvider } from "./external-api-usage-provider";

export class ModelingFileDecorationProvider
  extends DisposableObject
  implements FileDecorationProvider
{
  constructor(private readonly provider: ExternalApiUsageProvider) {
    super();
  }

  provideFileDecoration(uri: Uri): ProviderResult<FileDecoration> {
    if (uri.scheme === "codeql-modeling" && uri.authority === "method") {
      const signature = decodeURIComponent(uri.path.slice(1));
      const method = this.provider.externalApiUsages.find(
        (method) => method.signature === signature,
      );
      if (!method) {
        return undefined;
      }

      return new FileDecoration(method.usages.length.toString());
    }

    return undefined;
  }
}
