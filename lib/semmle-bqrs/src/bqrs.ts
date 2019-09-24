import { ResultSetSchema } from './bqrs-schema';
import { StreamDigester, ChunkIterator } from 'semmle-io';
import { parseResultSetsHeader, StringPool, parseResultSetSchema, parseTuples, TupleParser } from './bqrs-parse';

export async function parse(rs: ChunkIterator,
  resultSetHandler: (resultSet: ResultSetSchema) => TupleParser): Promise<void> {

  const d = StreamDigester.fromChunkIterator(rs);

  const header = await parseResultSetsHeader(d);
  const stringPool = new StringPool(await d.read(header.stringPoolSize));
  for (let resultSetIndex = 0; resultSetIndex < header.resultSetCount; resultSetIndex++) {
    await d.readLEB128UInt32();  // Length of result set. Unused.
    const resultSetSchema = await parseResultSetSchema(d);
    const tupleParser = resultSetHandler(resultSetSchema);
    await parseTuples(d, resultSetSchema, stringPool, tupleParser);
  }
}
