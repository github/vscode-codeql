import { join } from "path";
import type { QueryLanguage } from "../common/query-language";
import { writeFile } from "fs-extra";
import { dump } from "js-yaml";
import {
  prepareModelEditorQueries,
  resolveEndpointsQuery,
  syntheticQueryPackName,
} from "./model-editor-queries";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { Mode } from "./shared/mode";
import type { NotificationLogger } from "../common/logging";

/**
 * setUpPack sets up a directory to use for the data extension editor queries if required.
 *
 * There are two cases (example language is Java):
 * - In case the queries are present in the codeql/java-queries, we don't need to write our own queries
 *   to disk. We still need to create a synthetic query pack so we can pass the queryDir to the query
 *   resolver without caring about whether the queries are present in the pack or not.
 * - In case the queries are not present in the codeql/java-queries, we need to write our own queries
 *   to disk. We will create a synthetic query pack and install its dependencies so it is fully independent
 *   and we can simply pass it through when resolving the queries.
 *
 * These steps together ensure that later steps of the process don't need to keep track of whether the queries
 * are present in codeql/java-queries or in our own query pack. They just need to resolve the query.
 *
 * @param cliServer The CodeQL CLI server to use.
 * @param logger The logger to use.
 * @param queryDir The directory to set up.
 * @param language The language to use for the queries.
 * @param initialMode The initial mode to use to check the existence of the queries.
 * @returns true if the setup was successful, false otherwise.
 */
export async function setUpPack(
  cliServer: CodeQLCliServer,
  logger: NotificationLogger,
  queryDir: string,
  language: QueryLanguage,
  initialMode: Mode,
): Promise<boolean> {
  // Download the required query packs
  await cliServer.packDownload([`codeql/${language}-queries`]);

  // We'll only check if the application mode query exists in the pack and assume that if it does,
  // the framework mode query will also exist.
  const applicationModeQuery = await resolveEndpointsQuery(
    cliServer,
    language,
    initialMode,
    [],
    [],
  );

  if (applicationModeQuery) {
    // Set up a synthetic pack so CodeQL doesn't crash later when we try
    // to resolve a query within this directory
    const syntheticQueryPack = {
      name: syntheticQueryPackName,
      version: "0.0.0",
      dependencies: {},
    };

    const qlpackFile = join(queryDir, "codeql-pack.yml");
    await writeFile(qlpackFile, dump(syntheticQueryPack), "utf8");
  } else {
    // If we can't resolve the query, we need to write them to desk ourselves.
    const externalApiQuerySuccess = await prepareModelEditorQueries(
      logger,
      queryDir,
      language,
    );
    if (!externalApiQuerySuccess) {
      return false;
    }

    // Set up a synthetic pack so that the query can be resolved later.
    const syntheticQueryPack = {
      name: syntheticQueryPackName,
      version: "0.0.0",
      dependencies: {
        [`codeql/${language}-all`]: "*",
      },
    };

    const qlpackFile = join(queryDir, "codeql-pack.yml");
    await writeFile(qlpackFile, dump(syntheticQueryPack), "utf8");
    await cliServer.packInstall(queryDir);
  }

  return true;
}
