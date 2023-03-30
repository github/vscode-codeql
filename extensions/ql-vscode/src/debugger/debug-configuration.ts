import {
  CancellationToken,
  DebugConfiguration,
  DebugConfigurationProvider,
  WorkspaceFolder,
} from "vscode";
import { getOnDiskWorkspaceFolders, showAndLogErrorMessage } from "../helpers";

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

    const resultConfiguration: QLResolvedDebugConfiguration = {
      ...qlConfiguration,
      query: qlConfiguration.query,
      database: qlConfiguration.database,
      additionalPacks:
        // Fill in defaults here, instead of in `resolveDebugConfiguration`, to avoid the highly
        // unusual case where one of the workspace folder paths contains something that looks like a
        // variable substitution.
        qlConfiguration.additionalPacks === undefined
          ? getOnDiskWorkspaceFolders()
          : typeof qlConfiguration.additionalPacks === "string"
          ? [qlConfiguration.additionalPacks]
          : qlConfiguration.additionalPacks,
      extensionPacks:
        qlConfiguration.extensionPacks === undefined
          ? []
          : typeof qlConfiguration.extensionPacks === "string"
          ? [qlConfiguration.extensionPacks]
          : qlConfiguration.extensionPacks,
    };

    return resultConfiguration;
  }
}
