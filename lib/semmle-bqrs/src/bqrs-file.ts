import { RandomAccessReader, StreamDigester } from 'semmle-io';
import { parseResultSetsHeader, StringPool, parseResultSetSchema, readTuples } from './bqrs-parse';
import { ResultSetsSchema, ResultSetSchema } from './bqrs-schema';
import { ColumnValue } from './bqrs-results';

interface RegionResult<T> {
  result: T,
  finalPosition: number
}

async function inFileRegion<T>(file: RandomAccessReader, start: number, end: number | undefined,
  parse: (d: StreamDigester) => Promise<T>): Promise<RegionResult<T>> {

  const stream = file.readStream(start, end);
  try {
    const d = StreamDigester.fromChunkIterator(stream);
    const result = await parse(d);

    return {
      result: result,
      finalPosition: d.position
    };
  }
  finally {
    stream.dispose();
  }
}

/**
 * A single result set in a BQRS file.
 */
export interface ResultSetReader {
  /**
   * The schema that describes the result set.
   */
  readonly schema: ResultSetSchema;
  /**
   * Read all of the tuples in the result set.
   */
  readTuples(): AsyncIterableIterator<ColumnValue[]>;
}

/**
 * A Binary Query Result Sets ("BQRS") file.
 *
 * @remarks
 * Allows independant access to individual tables without having to parse the entire file up front.
 */
export interface ResultSetsReader {
  readonly schema: ResultSetsSchema;
  readonly resultSets: readonly ResultSetReader[];

  findResultSetByName(name: string): ResultSetReader | undefined;
}

interface ResultSetInfo {
  schema: ResultSetSchema;
  rowsOffset: number;
  rowsLength: number;
}

class ResultSetReaderImpl implements ResultSetReader {
  public readonly schema: ResultSetSchema;
  private readonly rowsOffset: number;
  private readonly rowsLength: number;

  public constructor(private readonly resultSets: ResultSetsReaderImpl, info: ResultSetInfo) {
    this.schema = info.schema;
    this.rowsOffset = info.rowsOffset;
    this.rowsLength = info.rowsLength;
  }

  public async* readTuples(): AsyncIterableIterator<ColumnValue[]> {
    const stream = this.resultSets.file.readStream(this.rowsOffset,
      this.rowsOffset + this.rowsLength);
    try {
      const d = StreamDigester.fromChunkIterator(stream);
      for await (const tuple of readTuples(d, this.schema, await this.resultSets.getStringPool())) {
        yield tuple;
      }
    }
    finally {
      stream.dispose();
    }
  }
}

class ResultSetsReaderImpl implements ResultSetsReader {
  private stringPool?: StringPool = undefined;
  private readonly _resultSets: ResultSetReaderImpl[];

  private constructor(public readonly file: RandomAccessReader,
    public readonly schema: ResultSetsSchema, resultSets: ResultSetInfo[],
    private readonly stringPoolOffset: number) {

    this._resultSets = resultSets.map((info) => {
      return new ResultSetReaderImpl(this, info);
    });
  }

  public get resultSets(): readonly ResultSetReader[] {
    return this._resultSets;
  }

  public findResultSetByName(name: string): ResultSetReader | undefined {
    return this._resultSets.find((resultSet) => resultSet.schema.name === name);
  }

  public async getStringPool(): Promise<StringPool> {
    if (this.stringPool === undefined) {
      const { result: stringPoolBuffer } = await inFileRegion(this.file, this.stringPoolOffset,
        this.stringPoolOffset + this.schema.stringPoolSize,
        async d => await d.read(this.schema.stringPoolSize));
      this.stringPool = new StringPool(stringPoolBuffer);
    }

    return this.stringPool;
  }

  public static async open(file: RandomAccessReader): Promise<ResultSetsReader> {
    const { result: header, finalPosition: stringPoolOffset } =
      await inFileRegion(file, 0, undefined, d => parseResultSetsHeader(d));

    let currentResultSetOffset = stringPoolOffset + header.stringPoolSize;

    const resultSets: ResultSetInfo[] = [];
    for (let resultSetIndex = 0; resultSetIndex < header.resultSetCount; resultSetIndex++) {
      const { result: info, finalPosition } =
        await inFileRegion(file, currentResultSetOffset, undefined, async (d) => {
          const length = await d.readLEB128UInt32();
          const headerStartPosition = d.position;
          const resultSetSchema = await parseResultSetSchema(d);

          return {
            schema: resultSetSchema,
            rowsOffset: d.position + currentResultSetOffset,
            rowsLength: length - (d.position - headerStartPosition)
          };
        });

      resultSets.push(info);
      currentResultSetOffset = finalPosition;
    }

    const schema: ResultSetsSchema = {
      version: header.version,
      stringPoolSize: header.stringPoolSize,
      resultSets: resultSets.map(resultSet => resultSet.schema)
    };

    const reader = new ResultSetsReaderImpl(file, schema, resultSets, stringPoolOffset);

    return reader;
  }
}

export function open(file: RandomAccessReader): Promise<ResultSetsReader> {
  return ResultSetsReaderImpl.open(file);
}
