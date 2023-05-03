import { CodeQLCliServer } from "../codeql-cli/cli";
import { Logger } from "../common";
import { transformBqrsResultSet } from "../pure/bqrs-cli-types";
import { AnalysisRawResults } from "./shared/analysis-result";
import { MAX_RAW_RESULTS } from "./shared/result-limits";
import { SELECT_TABLE_NAME } from "../pure/interface-types";

export async function extractRawResults(
  cliServer: CodeQLCliServer,
  logger: Logger,
  filePath: string,
  fileLinkPrefix: string,
  sourceLocationPrefix: string,
): Promise<AnalysisRawResults> {
  const bqrsInfo = await cliServer.bqrsInfo(filePath);
  const resultSets = bqrsInfo["result-sets"];

  if (resultSets.length < 1) {
    throw new Error("No result sets found in results file.");
  }
  if (resultSets.length > 1) {
    void logger.log(
      "Multiple result sets found in results file. Only one will be used.",
    );
  }

  // Always prefer #select over any other result set. #select is usually the result the user
  // wants to see since it contains the outer #select.
  const schema =
    resultSets.find((resultSet) => resultSet.name === SELECT_TABLE_NAME) ??
    resultSets[0];

  const chunk = await cliServer.bqrsDecode(filePath, schema.name, {
    pageSize: MAX_RAW_RESULTS,
  });

  const resultSet = transformBqrsResultSet(schema, chunk);

  const capped = !!chunk.next;

  return { schema, resultSet, fileLinkPrefix, sourceLocationPrefix, capped };
}
