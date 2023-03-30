import {
  CancellationToken,
  DebugConfiguration,
  DebugConfigurationProvider,
  WorkspaceFolder,
} from "vscode";
import { getOnDiskWorkspaceFolders, showAndLogErrorMessage } from "../helpers";
import { LocalQueries } from "../local-queries";

interface QLDebugArgs {
  query: string;
  database: string;
  additionalPacks: string[] | string;
  extensionPacks: string[] | string;
}

type QLDebugConfiguration = DebugConfiguration & Partial<QLDebugArgs>;

interface QLResolvedDebugArgs extends QLDebugArgs {
  additionalPacks: string[];
  extensionPacks: string[];
}

export type QLResolvedDebugConfiguration = DebugConfiguration &
  QLResolvedDebugArgs;

export class QLDebugConfigurationProvider
  implements DebugConfigurationProvider
{
  public constructor(private readonly localQueries: LocalQueries) {}

  public resolveDebugConfiguration(
    _folder: WorkspaceFolder | undefined,
    debugConfiguration: DebugConfiguration,
    _token?: CancellationToken,
  ): DebugConfiguration {
    const qlConfiguration = <QLDebugConfiguration>debugConfiguration;

    // Fill in defaults
    const resultConfiguration: QLDebugConfiguration = {
      ...qlConfiguration,
      query: qlConfiguration.query ?? "${file}",
      database: qlConfiguration.database ?? "${command:currentDatabase}",
    };

    return resultConfiguration;
  }

  public async resolveDebugConfigurationWithSubstitutedVariables(
    _folder: WorkspaceFolder | undefined,
    debugConfiguration: DebugConfiguration,
    _token?: CancellationToken,
  ): Promise<DebugConfiguration | null> {
    const qlConfiguration = <QLDebugConfiguration>debugConfiguration;
    if (qlConfiguration.query === undefined) {
      await showAndLogErrorMessage(
        "No query was specified in the debug configuration.",
      );
      return null;
    }
    if (qlConfiguration.database === undefined) {
      await showAndLogErrorMessage(
        "No database was specified in the debug configuration.",
      );
      return null;
    }

    // Fill in defaults here, instead of in `resolveDebugConfiguration`, to avoid the highly
    // unusual case where one of the computed default values looks like a variable substitution.
    const additionalPacks =
      qlConfiguration.additionalPacks === undefined
        ? getOnDiskWorkspaceFolders()
        : typeof qlConfiguration.additionalPacks === "string"
        ? [qlConfiguration.additionalPacks]
        : qlConfiguration.additionalPacks;

    // Default to computing the extension packs based on the extension configuration and the search
    // path.
    const extensionPacks =
      qlConfiguration.extensionPacks === undefined
        ? await this.localQueries.getDefaultExtensionPacks(additionalPacks)
        : typeof qlConfiguration.extensionPacks === "string"
        ? [qlConfiguration.extensionPacks]
        : qlConfiguration.extensionPacks;

    const resultConfiguration: QLResolvedDebugConfiguration = {
      ...qlConfiguration,
      query: qlConfiguration.query,
      database: qlConfiguration.database,
      additionalPacks,
      extensionPacks,
    };

    return resultConfiguration;
  }
}
