import type {
  CancellationToken,
  DebugConfiguration,
  DebugConfigurationProvider,
  WorkspaceFolder,
} from "vscode";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import type { LocalQueries } from "../local-queries";
import { getQuickEvalContext, validateQueryPath } from "../run-queries-shared";
import type { LaunchConfig } from "./debug-protocol";
import type { NotArray } from "../common/helpers-pure";
import { getErrorMessage } from "../common/helpers-pure";
import { showAndLogErrorMessage } from "../common/logging";
import { extLogger } from "../common/logging/vscode";

/**
 * The CodeQL launch arguments, as specified in "launch.json".
 */
export interface QLDebugArgs {
  query?: string;
  database?: string;
  additionalPacks?: string[] | string;
  extensionPacks?: string[] | string;
  quickEval?: boolean;
  noDebug?: boolean;
  additionalRunQueryArgs?: Record<string, unknown>;
}

/**
 * The debug configuration for a CodeQL configuration.
 *
 * This just combines `QLDebugArgs` with the standard debug configuration properties.
 */
export type QLDebugConfiguration = DebugConfiguration & QLDebugArgs;

/**
 * A CodeQL debug configuration after all variables and defaults have been resolved. This is what
 * is passed to the debug adapter via the `launch` request.
 */
export type QLResolvedDebugConfiguration = DebugConfiguration & LaunchConfig;

/** If the specified value is a single element, then turn it into an array containing that element. */
function makeArray<T extends NotArray>(value: T | T[]): T[] {
  if (Array.isArray(value)) {
    return value;
  } else {
    return [value];
  }
}

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
    try {
      const qlConfiguration = debugConfiguration as QLDebugConfiguration;
      if (qlConfiguration.query === undefined) {
        throw new Error("No query was specified in the debug configuration.");
      }
      if (qlConfiguration.database === undefined) {
        throw new Error(
          "No database was specified in the debug configuration.",
        );
      }

      // Fill in defaults here, instead of in `resolveDebugConfiguration`, to avoid the highly
      // unusual case where one of the computed default values looks like a variable substitution.
      const additionalPacks = makeArray(
        qlConfiguration.additionalPacks ?? getOnDiskWorkspaceFolders(),
      );

      // Default to computing the extension packs based on the extension configuration and the search
      // path.
      const extensionPacks = makeArray(
        qlConfiguration.extensionPacks ??
          (await this.localQueries.getDefaultExtensionPacks(additionalPacks)),
      );

      const quickEval = qlConfiguration.quickEval ?? false;
      validateQueryPath(qlConfiguration.query, quickEval);

      const quickEvalContext = quickEval
        ? await getQuickEvalContext(undefined, false)
        : undefined;

      const resultConfiguration: QLResolvedDebugConfiguration = {
        name: qlConfiguration.name,
        request: qlConfiguration.request,
        type: qlConfiguration.type,
        query: qlConfiguration.query,
        database: qlConfiguration.database,
        additionalPacks,
        extensionPacks,
        quickEvalContext,
        noDebug: qlConfiguration.noDebug ?? false,
        additionalRunQueryArgs: qlConfiguration.additionalRunQueryArgs ?? {},
      };

      return resultConfiguration;
    } catch (e) {
      // Any unhandled exception will result in an OS-native error message box, which seems ugly.
      // We'll just show a real VS Code error message, then return null to prevent the debug session
      // from starting.
      void showAndLogErrorMessage(extLogger, getErrorMessage(e));
      return null;
    }
  }
}
