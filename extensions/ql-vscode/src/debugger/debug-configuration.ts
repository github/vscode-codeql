import {
  CancellationToken,
  DebugConfiguration,
  DebugConfigurationProvider,
  WorkspaceFolder,
} from "vscode";
import { getOnDiskWorkspaceFolders, showAndLogErrorMessage } from "../helpers";
import { LocalQueries } from "../local-queries";
import { getQuickEvalContext, validateQueryPath } from "../run-queries-shared";
import * as CodeQLDebugProtocol from "./debug-protocol";

/**
 * The CodeQL launch arguments, as specified in "launch.json".
 */
interface QLDebugArgs {
  query?: string;
  database?: string;
  additionalPacks?: string[] | string;
  extensionPacks?: string[] | string;
  quickEval?: boolean;
  noDebug?: boolean;
}

/**
 * The debug configuration for a CodeQL configuration.
 *
 * This just combines `QLDebugArgs` with the standard debug configuration properties.
 */
type QLDebugConfiguration = DebugConfiguration & QLDebugArgs;

/**
 * A CodeQL debug configuration after all variables and defaults have been resolved. This is what
 * is passed to the debug adapter via the `launch` request.
 */
export type QLResolvedDebugConfiguration = DebugConfiguration &
  CodeQLDebugProtocol.LaunchConfig;

/**
 * Implementation of `DebugConfigurationProvider` for CodeQL.
 */
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

    // Fill in defaults for properties whose default value is a command invocation. VS Code will
    // invoke any commands to fill in  actual values, then call
    // `resolveDebugConfigurationWithSubstitutedVariables()`with the result.
    const resultConfiguration: QLDebugConfiguration = {
      ...qlConfiguration,
      query: qlConfiguration.query ?? "${command:currentQuery}",
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

    const quickEval = qlConfiguration.quickEval ?? false;
    validateQueryPath(qlConfiguration.query, quickEval);

    const quickEvalContext = quickEval
      ? await getQuickEvalContext(undefined)
      : undefined;

    const resultConfiguration: QLResolvedDebugConfiguration = {
      name: qlConfiguration.name,
      request: qlConfiguration.request,
      type: qlConfiguration.type,
      query: qlConfiguration.query,
      database: qlConfiguration.database,
      additionalPacks,
      extensionPacks,
      quickEvalPosition: quickEvalContext?.quickEvalPosition,
      noDebug: qlConfiguration.noDebug ?? false,
    };

    return resultConfiguration;
  }
}
