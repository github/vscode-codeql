import * as fs from 'fs-extra';
import { ReadStream } from 'fs-extra';
import { RandomAccessReader, StreamReader } from 'semmle-io';

export class FileReader implements RandomAccessReader {
  private _fd?: number;

  private constructor(fd: number) {
    this._fd = fd;
  }

  public dispose(): void {
    if (this._fd !== undefined) {
      fs.closeSync(this._fd);
      this._fd = undefined;
    }
  }

  public get fd(): number {
    if (this._fd === undefined) {
      throw new Error('Object disposed.');
    }

    return this._fd;
  }

  public readStream(start?: number, end?: number): StreamReader {
    return new FileStreamReader(fs.createReadStream('', {
      fd: this.fd,
      start: start,
      end: end,
      autoClose: false
    }));
  }

  public static async open(file: string): Promise<FileReader> {
    const fd: number = await fs.open(file, 'r');
    return new FileReader(fd);  // Take ownership
  }
}

class FileStreamReader implements StreamReader {
  private _stream?: ReadStream;

  public constructor(stream: ReadStream) {
    this._stream = stream;
  }

  public [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    return this.stream[Symbol.asyncIterator]();
  }

  public dispose(): void {
    if (this._stream !== undefined) {
      this._stream = undefined;
    }
  }

  private get stream(): ReadStream {
    if (this._stream === undefined) {
      throw new Error('Object disposed.');
    }

    return this._stream;
  }
}
