import { join } from "path";
import { QueryLanguage } from "../common/query-language";
import { writeFile } from "fs-extra";
import { dump } from "js-yaml";
import { prepareExternalApiQuery } from "./external-api-usage-queries";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { ModelConfig } from "../config";
import { Mode } from "./shared/mode";
import { resolveQueriesFromPacks } from "../local-queries";
import { modeTag } from "./mode-tag";

export const syntheticQueryPackName = "codeql/external-api-usage";

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
 * @param queryDir The directory to set up.
 * @param language The language to use for the queries.
 * @param modelConfig The model config to use.
 * @returns true if the setup was successful, false otherwise.
 */
export async function setUpPack(
  cliServer: CodeQLCliServer,
  queryDir: string,
  language: QueryLanguage,
  modelConfig: ModelConfig,
): Promise<boolean> {
  // Download the required query packs
  await cliServer.packDownload([`codeql/${language}-queries`]);

  // We'll only check if the application mode query exists in the pack and assume that if it does,
  // the framework mode query will also exist.
  const applicationModeQuery = await resolveEndpointsQuery(
    cliServer,
    language,
    Mode.Application,
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
    const externalApiQuerySuccess = await prepareExternalApiQuery(
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

  // Download any other required packs
  if (language === "java" && modelConfig.llmGeneration) {
    await cliServer.packDownload([`codeql/${language}-automodel-queries`]);
  }

  return true;
}

/**
 * Resolve the query path to the model editor endpoints query. All queries are tagged like this:
 * modeleditor endpoints <mode>
 * Example: modeleditor endpoints framework-mode
 *
 * @param cliServer The CodeQL CLI server to use.
 * @param language The language of the query pack to use.
 * @param mode The mode to resolve the query for.
 * @param additionalPackNames Additional pack names to search.
 * @param additionalPackPaths Additional pack paths to search.
 */
export async function resolveEndpointsQuery(
  cliServer: CodeQLCliServer,
  language: string,
  mode: Mode,
  additionalPackNames: string[] = [],
  additionalPackPaths: string[] = [],
): Promise<string | undefined> {
  const packsToSearch = [`codeql/${language}-queries`, ...additionalPackNames];

  // First, resolve the query that we want to run.
  // All queries are tagged like this:
  // internal extract automodel <mode> <queryTag>
  // Example: internal extract automodel framework-mode candidates
  const queries = await resolveQueriesFromPacks(
    cliServer,
    packsToSearch,
    {
      kind: "table",
      "tags contain all": ["modeleditor", "endpoints", modeTag(mode)],
    },
    additionalPackPaths,
  );
  if (queries.length > 1) {
    throw new Error(
      `Found multiple endpoints queries for ${mode}. Can't continue`,
    );
  }

  if (queries.length === 0) {
    return undefined;
  }

  return queries[0];
}
