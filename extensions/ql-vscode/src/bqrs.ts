import { Readable } from 'stream';
import {
  Column, ColumnType, LocationStyle, LocationValue, PoolString,
  ResultSet, ResultSets, Tuple, TupleValue
} from './bqrs-types';
import { BufferDigester, Digester, StreamDigester } from './digester';

/**
 * bqrs.ts
 * -------
 *
 * Parsing Binary Query Result Set files.
 * See [[https://git.semmle.com/Semmle/code/tree/master/queryserver-client/src/com/semmle/api/result/BinaryQueryResultSets.java]].
 */

const RESULT_SET_VERSION = 1;
const RESULT_SETS_VERSION = 2;

export async function parse(rs: Readable): Promise<ResultSets> {
  const d = new StreamDigester(rs);
  const version = await d.readUInt32();
  if (version != RESULT_SETS_VERSION) {
    throw new Error("Mismatched binary query results version. Got " + version + " expected " + RESULT_SETS_VERSION);
  }
  const numberOfResultSets = await d.readUInt32();
  const stringPoolSize = await d.readUInt32();
  const stringPool = await d.read(stringPoolSize);
  const rv: ResultSets = {
    header: { version, numberOfResultSets, stringPoolSize }, results: []
  };
  for (let i = 0; i < numberOfResultSets; i++) {
    const length = await d.readUInt32();
    const resultSet = await d.read(length);
    rv.results.push(await parseResultSet(new BufferDigester(resultSet), stringPool));
  }
  return rv;
}

async function getPoolString(pool: Buffer, offset: number): Promise<PoolString> {
  return await (new BufferDigester(pool.slice(offset))).readString();
}

async function parseString(d: Digester, pool: Buffer): Promise<PoolString> {
  return getPoolString(pool, await d.readUInt32());
}

async function parseLocation(d: Digester, t: LocationStyle, pool: Buffer): Promise<LocationValue> {
  switch (t) {
    case LocationStyle.No: return { t };
    case LocationStyle.String: return { t, loc: await parseString(d, pool) };
    case LocationStyle.FivePart: {
      const file = await parseString(d, pool);
      const lineStart = await d.readUInt32();
      const colStart = await d.readUInt32();
      const lineEnd = await d.readUInt32();
      const colEnd = await d.readUInt32();
      return { t, file, lineStart, colStart, lineEnd, colEnd };
    }
  }
  throw new Error(`Unknown Location Style ${t}`);
}

async function parseColumn(d: Digester, t: ColumnType, pool: Buffer): Promise<TupleValue> {
  if (typeof t == 'object') {
    let primitive = await parseColumn(d, t.primitiveType, pool);
    const label = t.hasLabel ? await parseString(d, pool) : undefined;
    const loc = await parseLocation(d, t.locationStyle, pool);
    return {
      t: 'e', primitive, label, loc
    };
  }
  else {
    switch (t) {
      case 's': return { t, v: await parseString(d, pool) };
      case 'b': return { t, v: (await d.readByte()) != 0 };
      case 'i': return { t, v: await d.readUInt32() };
      case 'f': return { t, v: (await d.read(8)).readDoubleLE(0) };
      case 'd': return { t, v: await d.read(8) };
      case 'u': return { t, v: await parseString(d, pool) };
    }
    throw new Error(`Unknown Location Style ${t}`);
  }
}

async function parseTuple(d: Digester, columns: Column[], stringPool: Buffer): Promise<Tuple> {
  const rv: Tuple = [];
  for (let col of columns) {
    rv.push(await parseColumn(d, col.t, stringPool));
  }
  return rv;
}

async function parseResultSet(d: Digester, stringPool: Buffer): Promise<ResultSet> {
  const version = await d.readUInt32();
  if (version != RESULT_SET_VERSION) {
    throw new Error("Mismatched binary query result version. Got " + version + " expected " + RESULT_SET_VERSION);
  }
  const name = await d.readString();
  const numTuples = await d.readUInt32();
  const columns = await parseResultArranger(d);
  const results: Tuple[] = [];
  for (let i = 0; i < numTuples; i++) {
    results.push(await parseTuple(d, columns, stringPool));
  }
  return { version, name, numTuples, columns, results };
}

async function parseResultColumnType(d: Digester): Promise<ColumnType> {
  const t = (await d.read(1)).toString('ascii');
  if (t == 'e') {
    const primitiveType = (await d.read(1)).toString('ascii');
    const hasLabel = (await d.read(1))[0] != 0;
    const locationStyle = (await d.read(1))[0];
    return { locationStyle, hasLabel, primitiveType };
  }
  else {
    return t;
  }
}

async function parseResultArranger(d: Digester): Promise<Column[]> {
  const numColumns = await d.readUInt32();
  const rv: Column[] = [];
  for (let i = 0; i < numColumns; i++) {
    const name = (await d.readString());
    const t = await parseResultColumnType(d);
    rv.push({ name, t });
  }
  return rv;
}
