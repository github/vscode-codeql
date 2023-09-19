import { join } from "path";
import { QueryLanguage } from "../common/query-language";
import { writeFile } from "fs-extra";
import { dump } from "js-yaml";
import { prepareExternalApiQuery } from "./external-api-usage-queries";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { showLlmGeneration } from "../config";

/**
 * setUpPack sets up a directory to use for the data extension editor queries.
 * @param queryDir The directory to set up.
 * @param language The language to use for the queries.
 * @returns true if the setup was successful, false otherwise.
 */
export async function setUpPack(
  cliServer: CodeQLCliServer,
  queryDir: string,
  language: QueryLanguage,
): Promise<boolean> {
  // Create the external API query
  const externalApiQuerySuccess = await prepareExternalApiQuery(
    queryDir,
    language,
  );
  if (!externalApiQuerySuccess) {
    return false;
  }

  // Set up a synthetic pack so that the query can be resolved later.
  const syntheticQueryPack = {
    name: "codeql/external-api-usage",
    version: "0.0.0",
    dependencies: {
      [`codeql/${language}-all`]: "*",
    },
  };

  const qlpackFile = join(queryDir, "codeql-pack.yml");
  await writeFile(qlpackFile, dump(syntheticQueryPack), "utf8");
  await cliServer.packInstall(queryDir);

  // Install the other needed query packs
  await cliServer.packDownload([`codeql/${language}-queries`]);

  if (language === "java" && showLlmGeneration()) {
    await cliServer.packDownload([`codeql/${language}-automodel-queries`]);
  }

  return true;
}
