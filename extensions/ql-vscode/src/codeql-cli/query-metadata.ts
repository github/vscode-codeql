import { CodeQLCliServer } from "./cli";
import { QueryMetadata } from "../pure/interface-types";
import { extLogger } from "../common";

/**
 * Gets metadata for a query, if it exists.
 * @param cliServer The CLI server.
 * @param queryPath The path to the query.
 * @returns A promise that resolves to the query metadata, if available.
 */
export async function tryGetQueryMetadata(
  cliServer: CodeQLCliServer,
  queryPath: string,
): Promise<QueryMetadata | undefined> {
  try {
    return await cliServer.resolveMetadata(queryPath);
  } catch (e) {
    // Ignore errors and provide no metadata.
    void extLogger.log(`Couldn't resolve metadata for ${queryPath}: ${e}`);
    return;
  }
}
