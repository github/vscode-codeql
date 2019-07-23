import { Readable } from 'stream';
import { decodeUInt32 } from 'leb';

/**
 * digester.ts
 * -----------
 *
 * A wrapper around node's stream and buffer types to make reading the
 * binary formats used by the QL query server a little more uniform
 * and convenient.
 *
 * I feel like I probably shouldn't have to have written some of this
 * code, but I looked at even node streams in 'paused' rather than
 * 'flowing' state, and it still seemed inconvenient to directly use
 * them with async/await. Maybe I'm wrong and there's a handy library
 * on npm to do exactly that. Would be nice to delete a lot of this in
 * that case.
 */

export abstract class Digester {
  protected abstract hasBytes(bytesWanted: number): boolean;
  abstract read(bytesWanted: number): Promise<Buffer>;

  /**
   * Read a variable-length sequence of bytes, at most MAX_LEN bytes long,
   * terminated by a byte whose most significant bit is set to zero. This
   * is appropriate for LEB128 encoded numbers.
   */
  async readMsbDelim(): Promise<Buffer> {
    const MAX_LEN = 8;
    const buf: number[] = [];
    while (1) {
      const byte = (await this.read(1))[0];
      buf.push(byte);
      if (!(byte & 128) || buf.length >= MAX_LEN)
        return Buffer.from(buf);
    }
    throw new Error("unreachable"); // lgtm[js/unreachable-statement]
  }

  /**
   * Read a leb128-encoded unsigned 32-bit number
   * [https://en.wikipedia.org/wiki/LEB128]
   */
  async readUInt32(): Promise<number> {
    return decodeUInt32(await this.readMsbDelim()).value
  }

  /**
   * Read a single byte.
   */
  async readByte(): Promise<number> {
    return (await this.read(1))[0];
  }

  /**
   * Read a string encoded as a LEB128 number n, followed by a
   * utf8-encoded string of length (n-1) bytes
   */
  async readString(): Promise<string> {
    const stringLength = await this.readUInt32() - 1;
    if (stringLength == -1) {
      // XXX why is this a possibility? Does a '(-1)-length' string
      // (i.e. a single 0x00 byte) mean something different from a
      // 0-length string? (i.e. a single 0x01 byte)
      return "";
    }
    return (await this.read(stringLength)).toString('utf8');
  }
}

type Reader = {
  rej: (x: Error) => void,
  res: (x: Buffer) => void,
  bytesWanted: number,
}

/**
 * A digester backed by a nodejs `stream.Readable`.
 *
 * XXX: performance is quite possibly subobtimal for streams arising
 * from `.createReadStream` on files. Buffer.slice(...) doesn't do a
 * copy, but I'm recklessly doing Buffer.concat(...) a bunch. I
 * haven't tested on large bqrs files, but it would be nice if we
 * could just pull out the first N tuples and do paging lazily.
 */
export class StreamDigester extends Digester {
  private buffer: Buffer;
  private readers: Reader[] = [];
  private ended: boolean = false;

  constructor(stream: Readable) {
    super();
    this.buffer = Buffer.from([]);
    stream.on('data', (data: Buffer) => {
      this.append(data);
    });
    stream.on('close', () => {
      this.ended = true;
      this.readers.forEach(reader => {
        const err = new Error(`stream ended before read could be completed, ${this.buffer.length} bytes available, ${reader.bytesWanted} bytes wanted.`);
        this.buffer = Buffer.from([]);
        (reader.rej)(err);
      });
    });
  }

  private append(data: Buffer) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.canResolve()) {
      const reader = (this.readers.shift())!;
      (reader.res)(this.grab(reader.bytesWanted));
    }
  }

  private canResolve() {
    return this.readers.length > 0 && this.hasBytes(this.readers[0].bytesWanted);
  }

  private grab(bytesWanted: number) {
    const rv = this.buffer.slice(0, bytesWanted);
    this.buffer = this.buffer.slice(bytesWanted);
    return rv;
  }

  protected hasBytes(bytesWanted: number): boolean {
    return this.buffer.length >= bytesWanted;
  }

  read(bytesWanted: number): Promise<Buffer> {
    if (this.hasBytes(bytesWanted)) {
      return Promise.resolve(this.grab(bytesWanted));
    }
    else {
      if (this.ended) {
        const err = new Error(`read attempted after end of stream, ${this.buffer.length} bytes available, ${bytesWanted} bytes wanted.`);
        this.buffer = Buffer.from([]);
        return Promise.reject(err);
      }
      else {
        return new Promise((res, rej) => {
          this.readers.push({ bytesWanted, res, rej });
        });
      }
    }
  }
}

/**
 * A digester backed by a nodejs `Buffer`.
 */
export class BufferDigester extends Digester {
  private buffer: Buffer;
  private pos: number = 0;

  constructor(buffer: Buffer) {
    super();
    this.buffer = buffer;
  }

  protected hasBytes(bytesWanted: number): boolean {
    return this.buffer.length >= this.pos + bytesWanted;
  }

  read(bytesWanted: number): Promise<Buffer> {
    if (this.hasBytes(bytesWanted)) {
      const read = this.buffer.slice(this.pos, this.pos + bytesWanted);
      this.pos += bytesWanted;
      return Promise.resolve(read);
    }
    else {
      const avail = this.buffer.length - this.pos;
      const err = new Error(`attempted read past end of buffer, ${avail} bytes available, ${bytesWanted} bytes wanted.`);
      this.pos = this.buffer.length;
      return Promise.reject(err);
    }
  }
}
