import { RandomAccessReader, StreamDigester } from 'semmle-io';
import { parseResultSetsHeader, StringPool, parseResultSetSchema, readTuples } from './bqrs-parse';
import { ResultSetsSchema, ResultSetSchema } from './bqrs-schema';
import { ColumnValue } from './bqrs-results';

/**
 * The result of parsing data from a specific file region.
 */
interface RegionResult<T> {
  /** The parsed data. */
  result: T,
  /** The exclusive end position of the parsed data in the file. */
  finalOffset: number
}

/** Reads data from the specified region of the file, and parses it using the given function. */
async function inFileRegion<T>(
  file: RandomAccessReader,
  start: number,
  end: number | undefined,
  parse: (d: StreamDigester) => Promise<T>
): Promise<RegionResult<T>> {
  const stream = file.readStream(start, end);
  try {
    const d = StreamDigester.fromChunkIterator(stream);
    const result = await parse(d);

    return {
      result: result,
      finalOffset: start + d.position
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
   * Reads all of the tuples in the result set.
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

/**
 * Metadata for a single `ResultSet` in a BQRS file.
 * Does not contain the result tuples themselves.
 * Includes the offset and length of the tuple data in the file,
 * which can be used to read the tuples.
 */
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
    // Parse the header of the entire BQRS file.
    const { result: header, finalOffset: stringPoolOffset } =
      await inFileRegion(file, 0, undefined, d => parseResultSetsHeader(d));

    // The header is followed by a shared string pool.
    // We have saved the offset and length of the string pool within the file,
    // so we can read it later when needed.
    // For now, skip over the string pool to reach the starting point of the first result set.
    let currentResultSetOffset = stringPoolOffset + header.stringPoolSize;

    //  Parse information about each result set within the file.
    const resultSets: ResultSetInfo[] = [];
    for (let resultSetIndex = 0; resultSetIndex < header.resultSetCount; resultSetIndex++) {
      // Read the length of this result set (encoded as a single byte).
      // Note: reading length and schema together from a file region may be more efficient.
      // Reading them separately just makes it easier to compute the
      // starting offset and length of the schema.
      const { result: resultSetLength, finalOffset: resultSetSchemaOffset } =
        await inFileRegion(file, currentResultSetOffset, undefined, d => d.readLEB128UInt32());

      // Read the schema of this result set.
      const { result: resultSetSchema, finalOffset: resultSetRowsOffset } =
        await inFileRegion(file, resultSetSchemaOffset, undefined, d => parseResultSetSchema(d));
      const resultSetSchemaLength = resultSetRowsOffset - resultSetSchemaOffset;

      // The schema is followed by the tuple/row data for the result set.
      // We save the offset and length of the tuple data within the file,
      // so we can read it later when needed.
      const info: ResultSetInfo = {
        // length of result set = length of schema + length of tuple data
        // The 1 byte that encodes the length itself is not counted.
        rowsLength: resultSetLength - resultSetSchemaLength,
        rowsOffset: resultSetRowsOffset,
        schema: resultSetSchema,
      };
      resultSets.push(info);
      // Skip over the tuple data of the current result set,
      // to reach the starting offset of the next result set.
      currentResultSetOffset = info.rowsOffset + info.rowsLength;
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
