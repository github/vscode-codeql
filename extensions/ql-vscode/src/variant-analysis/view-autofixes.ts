import type { RepositoriesFilterSortStateWithIds } from "./shared/variant-analysis-filter-sort";
import { defaultFilterSortState } from "./shared/variant-analysis-filter-sort";
import type { VariantAnalysis } from "./shared/variant-analysis";
import type { Credentials } from "../common/authentication";
import type { NotificationLogger } from "../common/logging";
import type { App } from "../common/app";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import { pathExists } from "fs-extra";
import { withProgress, progressUpdate } from "../common/vscode/progress";
import type { ProgressCallback } from "../common/vscode/progress";

/**
 * Generates autofixes for the results of a variant analysis.
 */
export async function viewAutofixesForVariantAnalysisResults(
  variantAnalysisId: number,
  filterSort: RepositoriesFilterSortStateWithIds = defaultFilterSortState,
  variantAnalyses: Map<number, VariantAnalysis>,
  credentials: Credentials,
  logger: NotificationLogger,
  storagePath: string,
  app: App,
  cliServer: CodeQLCliServer,
): Promise<void> {
  await withProgress(
    async (progress: ProgressCallback) => {
      // Get the path to the local autofix installation.
      progress(progressUpdate(1, 4, `Checking for local autofix installation`));
      const localAutofixPath = findLocalAutofix();

      // TODO
    },
    {
      title: "Generating Autofixes",
      cancellable: false, // not cancellable for now
    },
  );
}

/**
 * Finds the local autofix installation path from the AUTOFIX_PATH environment variable.
 * Throws an error if the path is not set or does not exist.
 * @returns An object containing the local autofix path.
 * @throws Error if the AUTOFIX_PATH environment variable is not set or the path does not exist.
 */
function findLocalAutofix(): string {
  const localAutofixPath = process.env.AUTOFIX_PATH;
  if (!localAutofixPath) {
    throw new Error("Path to local autofix installation not found.");
  }
  if (!pathExists(localAutofixPath)) {
    throw new Error(`Local autofix path ${localAutofixPath} does not exist.`);
  }
  return localAutofixPath;
}
