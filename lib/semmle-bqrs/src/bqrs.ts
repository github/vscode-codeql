import { ResultSetSchema, ColumnType } from './bqrs-schema';
import { TupleValue } from './bqrs-types';
import { StreamDigester, ChunkIterator } from 'semmle-io';
import { parseResultSetsHeader, StringPool, parseResultSetSchema, parseTuples, TupleParser } from './bqrs-parse';
import { ColumnValue, ElementBase } from './bqrs-results';

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

function createTupleValue(type: ColumnType, value: ColumnValue): TupleValue {
  if (type.type === 'e') {
    const element = <ElementBase>value;
    const result: TupleValue = {
      t: 'e',
      primitive: createTupleValue({ type: type.primitiveType }, element.id),
      label: element.label,
      loc: element.location
    };
    return result;
  }
  else {
    switch (type.type) {
      case 's': return { t: 's', v: <string>value };
      case 'b': return { t: 'b', v: <boolean>value };
      case 'i': return { t: 'i', v: <number>value };
      case 'f': return { t: 'f', v: <number>value };
      case 'd': return { t: 'd', v: <Date>value };
      case 'u': return { t: 'u', v: <string>value };
      default: throw new Error(`Unknown primitive column type '${type.type}'.`);
    }
  }
}
