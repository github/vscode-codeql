import { dirname } from "path";
import { findCommonParentDir } from "../common/files";
import { findPackRoot } from "../common/ql";

/**
 * This function finds the root directory of the QL pack that contains the provided query files.
 * It handles several cases:
 * - If no query files are provided, it throws an error.
 * - If all query files are in the same QL pack, it returns the root directory of that pack.
 * - If the query files are in different QL packs, it throws an error.
 * - If some query files are in a QL pack and some aren't, it throws an error.
 * - If none of the query files are in a QL pack, it returns the common parent directory of the query files. However,
 *   if there are more than one query files and they're not in the same workspace folder, it throws an error.
 *
 * @param queryFiles - An array of file paths for the query files.
 * @param workspaceFolders - An array of workspace folder paths.
 * @returns The root directory of the QL pack that contains the query files, or the common parent directory of the query files.
 */
export async function findVariantAnalysisQlPackRoot(
  queryFiles: string[],
  workspaceFolders: string[],
): Promise<string> {
  if (queryFiles.length === 0) {
    throw Error("No query files provided");
  }

  // Calculate the pack root for each query file
  const packRoots: Array<string | undefined> = [];
  for (const queryFile of queryFiles) {
    const packRoot = await findPackRoot(queryFile);
    packRoots.push(packRoot);
  }

  if (queryFiles.length === 1) {
    return packRoots[0] ?? dirname(queryFiles[0]);
  }

  const uniquePackRoots = Array.from(new Set(packRoots));

  if (uniquePackRoots.length > 1) {
    if (uniquePackRoots.includes(undefined)) {
      throw Error("Some queries are in a pack and some aren't");
    } else {
      throw Error("Some queries are in different packs");
    }
  }

  if (uniquePackRoots[0] === undefined) {
    return findQlPackRootForQueriesWithNoPack(queryFiles, workspaceFolders);
  } else {
    // All in the same pack, return that pack's root
    return uniquePackRoots[0];
  }
}

/**
 * For queries that are not in a pack, a potential pack root is the
 * common parent dir of all the queries. However, we only want to
 * return this if all the queries are in the same workspace folder.
 */
function findQlPackRootForQueriesWithNoPack(
  queryFiles: string[],
  workspaceFolders: string[],
): string {
  const queryFileWorkspaceFolders = queryFiles.map((queryFile) =>
    workspaceFolders.find((workspaceFolder) =>
      queryFile.startsWith(workspaceFolder),
    ),
  );

  // Check if any query file is not part of the workspace.
  if (queryFileWorkspaceFolders.includes(undefined)) {
    throw Error(
      "Queries that are not part of a pack need to be part of the workspace",
    );
  }

  // Check if query files are not in the same workspace folder.
  if (new Set(queryFileWorkspaceFolders).size > 1) {
    throw Error(
      "Queries that are not part of a pack need to be in the same workspace folder",
    );
  }

  // They're in the same workspace folder, so we can find a common parent dir.
  return findCommonParentDir(...queryFiles);
}
