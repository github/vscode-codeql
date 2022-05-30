import { CodeQLCliServer } from '../cli';
import { Logger } from '../logging';
import { transformBqrsResultSet } from '../pure/bqrs-cli-types';
import { AnalysisRawResults } from './shared/analysis-result';
import { MAX_RAW_RESULTS } from './shared/result-limits';

export async function extractRawResults(
  cliServer: CodeQLCliServer,
  logger: Logger,
  filePath: string,
  fileLinkPrefix: string,
  sourceLocationPrefix: string
): Promise<AnalysisRawResults> {
  const bqrsInfo = await cliServer.bqrsInfo(filePath);
  const resultSets = bqrsInfo['result-sets'];

  if (resultSets.length < 1) {
    throw new Error('No result sets found in results file.');
  }
  if (resultSets.length > 1) {
    void logger.log('Multiple result sets found in results file. Only the first one will be used.');
  }

  const schema = resultSets[0];

  const chunk = await cliServer.bqrsDecode(
    filePath,
    schema.name,
    { pageSize: MAX_RAW_RESULTS });

  const resultSet = transformBqrsResultSet(schema, chunk);

  const capped = !!chunk.next;

  return { schema, resultSet, fileLinkPrefix, sourceLocationPrefix, capped };
}
