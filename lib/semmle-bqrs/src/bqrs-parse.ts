import { decodeUInt32 } from 'leb';
import { StreamDigester } from 'semmle-io';
import { ColumnValue, RawLocationValue } from './bqrs-results';
import { ColumnSchema, ColumnType, LocationStyle, PrimitiveTypeKind, ResultSetSchema } from './bqrs-schema';

/**
 * bqrs-parse.ts
 * -------
 *
 * Parsing Binary Query Result Set files.
 * See [[https://git.semmle.com/Semmle/code/tree/master/queryserver-client/src/com/semmle/api/result/BinaryQueryResultSets.java]].
 */

const RESULT_SET_VERSION = 1;
const RESULT_SETS_VERSION = 2;

export type TupleParser = (tuple: readonly ColumnValue[]) => void;

export interface ResultSetsHeader {
  version: number,
  resultSetCount: number,
  stringPoolSize: number
}

async function parseResultColumnType(d: StreamDigester): Promise<ColumnType> {
  const t = await d.readASCIIChar();
  if (t === 'e') {
    const primitiveType: PrimitiveTypeKind =
      (await d.readASCIIChar()) as PrimitiveTypeKind;
    const hasLabel = (await d.readByte()) !== 0;
    const locationStyle = await d.readByte();
    return { type: 'e', locationStyle, hasLabel, primitiveType };
  }
  else {
    return { type: <PrimitiveTypeKind>t };
  }
}

async function parseColumnSchema(d: StreamDigester): Promise<ColumnSchema[]> {
  const numColumns = await d.readLEB128UInt32();
  const rv: ColumnSchema[] = [];
  for (let i = 0; i < numColumns; i++) {
    const name = await readLengthPrefixedString(d);
    const type = await parseResultColumnType(d);
    rv.push({ name, type });
  }
  return rv;
}

function getTrueStringLength(encodedLength: number): number {
  const stringLength = (encodedLength as number) - 1;
  if (stringLength === -1) {
    // XXX why is this a possibility? Does a '(-1)-length' string
    // (i.e. a single 0x00 byte) mean something different from a
    // 0-length string? (i.e. a single 0x01 byte)
    return 0;
  }
  else {
    return stringLength;
  }
}

export class StringPool {
  public constructor(private readonly buffer: Buffer) {
  }

  public getString(offset: number): string {
    //TODO: Memoize?
    const { value: encodedStringLength, nextIndex } = decodeUInt32(this.buffer, offset);
    const stringLength = getTrueStringLength(encodedStringLength);

    const value = this.buffer.toString('utf8', nextIndex, nextIndex + stringLength);
    return value;
  }
}

export async function parseResultSetsHeader(d: StreamDigester): Promise<ResultSetsHeader> {
  const version = await d.readLEB128UInt32();
  if (version !== RESULT_SETS_VERSION) {
    throw new Error(`Mismatched binary query results version. Got '${version}', but expected '${RESULT_SETS_VERSION}'.`);
  }
  const resultSetCount = await d.readLEB128UInt32();
  const stringPoolSize = await d.readLEB128UInt32();

  return {
    version: version,
    stringPoolSize: stringPoolSize,
    resultSetCount: resultSetCount
  };
}

async function readLengthPrefixedString(d: StreamDigester): Promise<string> {
  const encodedLength = await d.readLEB128UInt32();
  const stringLength = getTrueStringLength(encodedLength);
  return await d.readUTF8String(stringLength);
}

export async function parseResultSetSchema(d: StreamDigester): Promise<ResultSetSchema> {
  const version = await d.readLEB128UInt32();
  if (version !== RESULT_SET_VERSION) {
    throw new Error(`Mismatched binary query result version. Got '${version}', but expected '${RESULT_SET_VERSION}'.`);
  }
  const name = await readLengthPrefixedString(d);
  const tupleCount = await d.readLEB128UInt32();
  const columns = await parseColumnSchema(d);

  return {
    version: version,
    name: name,
    tupleCount: tupleCount,
    columns: columns
  };
}

async function parseString(d: StreamDigester, pool: StringPool): Promise<string> {
  const stringOffset = await d.readLEB128UInt32();
  const value = pool.getString(stringOffset);
  return value;
}

async function parseLocation(d: StreamDigester, t: LocationStyle, pool: StringPool):
  Promise<RawLocationValue | undefined> {

  switch (t) {
    case LocationStyle.None: return undefined;
    case LocationStyle.String: return { t, loc: await parseString(d, pool) };
    case LocationStyle.FivePart: {
      const file = await parseString(d, pool);
      const lineStart = await d.readLEB128UInt32();
      const colStart = await d.readLEB128UInt32();
      const lineEnd = await d.readLEB128UInt32();
      const colEnd = await d.readLEB128UInt32();
      return { t, file, lineStart, colStart, lineEnd, colEnd };
    }
    case LocationStyle.WholeFile:
      throw new Error('Whole-file locations should appear as string locations in BQRS files.');
  }
  throw new Error(`Unknown Location Style ${t}`);
}

async function parsePrimitiveColumn(d: StreamDigester, type: PrimitiveTypeKind,
  pool: StringPool): Promise<ColumnValue> {

  switch (type) {
    case 's': return await parseString(d, pool);
    case 'b': return await d.readByte() !== 0;
    case 'i': return await d.readLEB128UInt32();
    case 'f': return await d.readDoubleLE();
    case 'd': return await d.readDate();
    case 'u': return await parseString(d, pool);
    default: throw new Error(`Unknown primitive column type '${type}'.`);
  }
}

export async function parseColumn(d: StreamDigester, t: ColumnType, pool: StringPool):
  Promise<ColumnValue> {

  if (t.type === 'e') {
    let primitive = await parsePrimitiveColumn(d, t.primitiveType, pool);
    const label = t.hasLabel ? await parseString(d, pool) : undefined;
    const loc = await parseLocation(d, t.locationStyle, pool);
    return {
      id: <number | string>primitive,
      label: label,
      location: loc
    };
  }
  else {
    return parsePrimitiveColumn(d, t.type, pool);
  }
}

export async function* readTuples(d: StreamDigester, schema: ResultSetSchema,
  stringPool: StringPool): AsyncIterableIterator<ColumnValue[]> {

  const { tupleCount, columns } = schema;

  for (let rowIndex = 0; rowIndex < tupleCount; rowIndex++) {
    const tuple: ColumnValue[] = Array(columns.length);
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      tuple[columnIndex] = await parseColumn(d, columns[columnIndex].type, stringPool);
    }
    yield tuple;
  }
}

export async function parseTuples(d: StreamDigester, schema: ResultSetSchema,
  stringPool: StringPool, tupleParser: TupleParser): Promise<void> {

  const { tupleCount, columns } = schema;

  // Create a single temporary tuple to hold the values we read from each row. Fill it with
  // zero values initially so that we don't have to type it as `TupleValue | undefined`.
  const tempTuple: ColumnValue[] = Array(columns.length).fill(0);

  for (let rowIndex = 0; rowIndex < tupleCount; rowIndex++) {
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      tempTuple[columnIndex] = await parseColumn(d, columns[columnIndex].type, stringPool);
    }
    tupleParser(tempTuple);
  }
}
