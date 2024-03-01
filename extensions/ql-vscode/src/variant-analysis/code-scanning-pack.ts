import { join } from "path";
import type { BaseLogger } from "../common/logging";
import type { QueryLanguage } from "../common/query-language";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { QlPackDetails } from "./ql-pack-details";
import { getQlPackFilePath } from "../common/ql";
import { isSarifResultsQueryKind } from "../common/query-metadata";

export async function resolveCodeScanningQueryPack(
  logger: BaseLogger,
  cliServer: CodeQLCliServer,
  language: QueryLanguage,
): Promise<QlPackDetails> {
  // Get pack
  void logger.log(`Downloading pack for language: ${language}`);
  const packName = `codeql/${language}-queries`;
  const packDownloadResult = await cliServer.packDownload([packName]);
  const downloadedPack = packDownloadResult.packs[0];

  const packDir = join(
    packDownloadResult.packDir,
    downloadedPack.name,
    downloadedPack.version,
  );

  // Resolve queries
  void logger.log(`Resolving queries for pack: ${packName}`);
  const suitePath = join(
    packDir,
    "codeql-suites",
    `${language}-code-scanning.qls`,
  );
  const resolvedQueries = await cliServer.resolveQueries(suitePath);

  const problemQueries = await filterToOnlyProblemQueries(
    logger,
    cliServer,
    resolvedQueries,
  );

  if (problemQueries.length === 0) {
    throw Error(
      `No problem queries found in published query pack: ${packName}.`,
    );
  }

  // Return pack details
  const qlPackFilePath = await getQlPackFilePath(packDir);

  const qlPackDetails: QlPackDetails = {
    queryFiles: problemQueries,
    qlPackRootPath: packDir,
    qlPackFilePath,
    language,
  };

  return qlPackDetails;
}

async function filterToOnlyProblemQueries(
  logger: BaseLogger,
  cliServer: CodeQLCliServer,
  queries: string[],
): Promise<string[]> {
  const problemQueries: string[] = [];
  for (const query of queries) {
    const queryMetadata = await cliServer.resolveMetadata(query);
    if (isSarifResultsQueryKind(queryMetadata.kind)) {
      problemQueries.push(query);
    } else {
      void logger.log(`Skipping non-problem query ${query}`);
    }
  }
  return problemQueries;
}
