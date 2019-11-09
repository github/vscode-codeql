import * as leb from 'leb';

/**
 * digester.ts
 * -----------
 *
 * A wrapper around node's stream and buffer types to make reading the
 * binary formats used by the QL query server a little more uniform
 * and convenient.
 *
 * This works around limitations in using Node streams (whether 'paused' or 'flowing')
 * with async/await. This code can be simplified if there is a convenient library for doing this.
 */

export type ChunkIterator = AsyncIterable<Uint8Array>;

function endOfStreamError(): Error {
  return new Error('Attempt to read past end of stream.');
}

const emptyBuffer = Buffer.alloc(0);

/**
 * A class to read and decode bytes out of a sequence of `Buffer`s provided by an async iterator.
 */
export class StreamDigester {
  private static readonly MIN_SEAM_BUFFER_LENGTH = 256;

  private currentChunk = emptyBuffer;
  private seamBuffer = emptyBuffer;
  private done = false;
  private positionOfCurrentChunk = 0;
  private offsetInCurrentChunk = 0;
  private readonly chunks: AsyncIterator<Uint8Array>;

  private constructor(chunks: ChunkIterator) {
    this.chunks = chunks[Symbol.asyncIterator]();
  }

  /**
   * Create a `StreamDigester`.
   *
   * @param chunks An async iterator that provides the sequence of buffers from which to read.
   */
  public static fromChunkIterator(chunks: ChunkIterator): StreamDigester {
    return new StreamDigester(chunks);
  }

  public static fromBuffer(buffer: Buffer): StreamDigester {
    return new StreamDigester(StreamDigester.singleChunkIterator(buffer));
  }

  public get position(): number {
    return this.positionOfCurrentChunk + this.offsetInCurrentChunk;
  }

  private static async* singleChunkIterator(chunk: Buffer): AsyncIterableIterator<Buffer> {
    yield chunk;
  }

  /**
   * Gets the next chunk from the iterator, throwing an exception if there are no more chunks
   * available.
   */
  private async readNextChunk(): Promise<void> {
    if (this.done) {
      throw endOfStreamError();
    }

    const { value, done } = await this.chunks.next();
    if (done) {
      this.done = true;
      throw endOfStreamError();
    }

    this.positionOfCurrentChunk += this.currentChunk.length;
    this.currentChunk = Buffer.from(value);
    this.offsetInCurrentChunk = 0;
  }

  private get bytesLeftInCurrentChunk(): number {
    return this.currentChunk.length - this.offsetInCurrentChunk;
  }

  private getSeamBuffer(byteCount: number, previousBuffer: Buffer, previousOffset: number,
    previousByteCount: number): Buffer {

    const previousBytes = previousBuffer.subarray(previousOffset, previousByteCount);
    if (this.seamBuffer.length < byteCount) {
      // Start at double the current length, or `MIN_SEAM_BUFFER_LENGTH`, whichever is larger.
      let newSeamBufferLength = Math.max(this.seamBuffer.length * 2,
        StreamDigester.MIN_SEAM_BUFFER_LENGTH);
      while (newSeamBufferLength < byteCount) {
        newSeamBufferLength *= 2;
      }

      this.seamBuffer = Buffer.alloc(newSeamBufferLength);
    }
    if (previousByteCount > 0) {
      if (previousBuffer === this.seamBuffer) {
        if (previousOffset !== 0) {
          previousBuffer.copyWithin(0, previousOffset, previousOffset + previousByteCount);
        }
      }
      else {
        previousBuffer.copy(this.seamBuffer, 0, previousOffset, previousOffset + previousByteCount);
      }
    }

    return this.seamBuffer;
  }

  private async fillBuffer(buffer: Buffer, start: number, end: number): Promise<void> {
    let destOffset = start;
    do {
      const bytesToCopy = Math.min(end - destOffset, this.bytesLeftInCurrentChunk);
      this.currentChunk.copy(buffer, destOffset, this.offsetInCurrentChunk,
        this.offsetInCurrentChunk + bytesToCopy);
      this.offsetInCurrentChunk += bytesToCopy;
      destOffset += bytesToCopy;
      if (destOffset < end) {
        await this.readNextChunk();
      }
    } while (destOffset < end);
  }

  /**
   * Implements an async read that span multple buffers.
   *
   * @param canReadFunc Callback function to determine how many bytes are required to complete the
   *  read operation.
   * @param readFunc Callback function to read the requested data from a `Buffer`.
   */
  private async readAcrossSeam<T>(
    canReadFunc: (buffer: Buffer, start: number, byteCount: number) => number,
    readFunc: (buffer: Buffer, offset: number) => T): Promise<T> {

    // We'll copy the leftover bytes from the current chunk, plus whatever bytes we need from
    // subsequent chunks, into a "seam buffer", and read the value from there.
    let buffer = this.currentChunk;
    let offsetInBuffer = this.offsetInCurrentChunk;
    let discardedBytes = 0;
    let bytesInBuffer = this.bytesLeftInCurrentChunk;
    while (true) {
      // Ask how many bytes we need to complete the read.
      const requestedBytes = canReadFunc(buffer, offsetInBuffer, bytesInBuffer);
      if (requestedBytes <= bytesInBuffer) {
        // We have enough bytes. Do the read.
        const value = readFunc(buffer, offsetInBuffer);
        this.offsetInCurrentChunk += requestedBytes - discardedBytes;
        return value;
      }

      // We've already copied all the bytes from our current chunk to the seam buffer. We're
      // guaranteed to wind up reading all of those bytes, and will need at least one more byte, so
      // get the next chunk.
      await this.readNextChunk();

      // Create or extend our seam buffer to hold the additional bytes we're about to read.
      const bytesToCopy = Math.min(requestedBytes - bytesInBuffer, this.bytesLeftInCurrentChunk);
      buffer = this.getSeamBuffer(bytesInBuffer + bytesToCopy, buffer, offsetInBuffer, bytesInBuffer);
      discardedBytes = bytesInBuffer;
      offsetInBuffer = 0;

      // Append the new bytes to our seam buffer.
      this.currentChunk.copy(buffer, bytesInBuffer, 0, bytesToCopy);
      bytesInBuffer += bytesToCopy;
    }
  }

  private readVariableSize<T>(
    canReadFunc: (buffer: Buffer, start: number, byteCount: number) => number,
    readFunc: (buffer: Buffer, offset: number) => T): Promise<T> {

    const requestedBytes = canReadFunc(this.currentChunk, this.offsetInCurrentChunk,
      this.bytesLeftInCurrentChunk);
    if (requestedBytes <= this.bytesLeftInCurrentChunk) {
      const value = readFunc(this.currentChunk, this.offsetInCurrentChunk);
      this.offsetInCurrentChunk += requestedBytes;
      return Promise.resolve(value);
    }
    else {
      return this.readAcrossSeam(canReadFunc, readFunc);
    }
  }

  private readKnownSizeAcrossSeam<T>(byteCount: number,
    readFunc: (buffer: Buffer, offset: number) => T): Promise<T> {

    return this.readAcrossSeam((buffer, offset, availableByteCount) => byteCount, readFunc);
  }

  private readKnownSize<T>(byteCount: number, readFunc: (buffer: Buffer, offset: number) => T):
    Promise<T> {

    if (this.bytesLeftInCurrentChunk >= byteCount) {
      // We have enough data. Just read it directly.
      const value = readFunc(this.currentChunk, this.offsetInCurrentChunk);
      this.offsetInCurrentChunk += byteCount;
      return Promise.resolve(value);
    }
    else {
      return this.readKnownSizeAcrossSeam(byteCount, readFunc);
    }
  }

  /**
   * Read a leb128-encoded unsigned 32-bit number
   * [https://en.wikipedia.org/wiki/LEB128]
   */
  public readLEB128UInt32(): Promise<number> {
    return this.readVariableSize(canDecodeLEB128UInt32, decodeLEB128UInt32);
  }

  /**
   * Read a single byte.
   */
  public readByte(): Promise<number> {
    return this.readKnownSize(1, (buffer, offset) => buffer[offset]);
  }

  /**
   * Read a single ASCII character as a string.
   */
  public async readASCIIChar(): Promise<string> {
    return String.fromCodePoint(await this.readByte());
  }

  /**
   * Read the specified number of bytes.
   *
   * @param byteCount Number of bytes to read.
   */
  public async read(byteCount: number): Promise<Buffer> {
    const buffer = Buffer.alloc(byteCount);
    await this.fillBuffer(buffer, 0, byteCount);

    return buffer;
  }

  /**
   * Read a `Date` encoded as an 8-byte sequence.
   */
  public readDate(): Promise<Date> {
    return this.readKnownSize(8, decodeDate);
  }

  /**
   * Read a little-endian 64-bit IEEE floating-point number.
   */
  public readDoubleLE(): Promise<number> {
    return this.readKnownSize(8, (buffer, offset) => buffer.readDoubleLE(offset));
  }

  /**
   * Read a UTF-8 encoded string.
   * @param byteCount Length of encoded string in bytes.
   */
  public readUTF8String(byteCount: number): Promise<string> {
    return this.readKnownSize(byteCount, (buffer, offset) =>
      buffer.toString('utf8', offset, offset + byteCount));
  }
}

function decodeDate(buffer: Buffer, offset: number): Date {
  const low = buffer.readUInt32LE(offset);
  const high = buffer.readUInt32LE(offset + 4);

  const year = (high & 0x1ffffff0) >> 4;
  const month = high & 0x0000000f;
  const day = (low & 0xf8000000) >>> 27;
  const hours = (low & 0x07c00000) >> 22;
  const minutes = (low & 0x003f0000) >> 16;
  const seconds = (low & 0x0000fc00) >> 10;
  const ms = low & 0x000003ff;

  return new Date(year, month, day, hours, minutes, seconds, ms);
}

/**
 * The longest possible byte length of a correctly encoded LEB128 UInt32:
 * `0xff 0xff 0xff 0xff 0x8f` (5 bytes)
 */
const MAX_ENCODED_UINT32_LENGTH = 5;

function canDecodeLEB128UInt32(buffer: Buffer, offset: number, byteCount: number): number {
  const endOffset = offset + Math.min(byteCount, MAX_ENCODED_UINT32_LENGTH);
  for (let byteOffset = offset; byteOffset < endOffset; byteOffset++) {
    if ((buffer[byteOffset] & 0x80) === 0) {
      return (byteOffset - offset) + 1;
    }
  }

  if ((endOffset - offset) > MAX_ENCODED_UINT32_LENGTH) {
    throw new Error('Invalid LEB128 encoding.')
  }

  return MAX_ENCODED_UINT32_LENGTH;
}

function decodeLEB128UInt32(buffer: Buffer, offset: number): number {
  const { value } = leb.decodeUInt32(buffer, offset);
  return value;
}