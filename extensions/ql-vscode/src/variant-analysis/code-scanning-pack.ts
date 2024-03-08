import { join } from "path";
import { outputFile } from "fs-extra";
import { dump } from "js-yaml";
import { file } from "tmp-promise";
import type { BaseLogger } from "../common/logging";
import type { QueryLanguage } from "../common/query-language";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { QlPackDetails } from "./ql-pack-details";
import { getQlPackFilePath } from "../common/ql";
import type { SuiteInstruction } from "../packaging/suite-instruction";
import { SARIF_RESULTS_QUERY_KINDS } from "../common/query-metadata";
import type { CancellationToken } from "vscode";

export async function resolveCodeScanningQueryPack(
  logger: BaseLogger,
  cliServer: CodeQLCliServer,
  language: QueryLanguage,
  token: CancellationToken,
): Promise<QlPackDetails> {
  // Get pack
  void logger.log(`Downloading pack for language: ${language}`);
  const packName = `codeql/${language}-queries`;
  const packDownloadResult = await cliServer.packDownload([packName], token);
  const downloadedPack = packDownloadResult.packs[0];

  const packDir = join(
    packDownloadResult.packDir,
    downloadedPack.name,
    downloadedPack.version,
  );

  // Resolve queries
  void logger.log(`Resolving queries for pack: ${packName}`);

  const suiteYaml: SuiteInstruction[] = [
    {
      import: `codeql-suites/${language}-code-scanning.qls`,
      from: `${downloadedPack.name}@${downloadedPack.version}`,
    },
    {
      // This is necessary to ensure that the next import filter
      // is applied correctly
      exclude: {},
    },
    {
      // Only include problem queries
      include: {
        kind: SARIF_RESULTS_QUERY_KINDS,
      },
    },
  ];

  let resolvedQueries: string[];
  const suiteFile = await file({
    postfix: ".qls",
  });
  const suitePath = suiteFile.path;

  try {
    await outputFile(suitePath, dump(suiteYaml), "utf8");

    resolvedQueries = await cliServer.resolveQueries(suitePath);
  } finally {
    await suiteFile.cleanup();
  }

  if (resolvedQueries.length === 0) {
    throw Error(
      `No problem queries found in published query pack: ${packName}.`,
    );
  }

  // Return pack details
  const qlPackFilePath = await getQlPackFilePath(packDir);

  const qlPackDetails: QlPackDetails = {
    queryFiles: resolvedQueries,
    qlPackRootPath: packDir,
    qlPackFilePath,
    language,
  };

  return qlPackDetails;
}
