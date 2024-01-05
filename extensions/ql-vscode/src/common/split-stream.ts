import type { Readable } from "stream";
import { StringDecoder } from "string_decoder";

/**
 * Buffer to hold state used when splitting a text stream into lines.
 */
export class SplitBuffer {
  private readonly decoder = new StringDecoder("utf8");
  private readonly maxSeparatorLength: number;
  private buffer = "";
  private searchIndex = 0;
  private ended = false;

  constructor(private readonly separators: readonly string[]) {
    this.maxSeparatorLength = separators
      .map((s) => s.length)
      .reduce((a, b) => Math.max(a, b), 0);
  }

  /**
   * Append new text data to the buffer.
   * @param chunk The chunk of data to append.
   */
  public addChunk(chunk: Buffer): void {
    this.buffer += this.decoder.write(chunk);
  }

  /**
   * Signal that the end of the input stream has been reached.
   */
  public end(): void {
    this.buffer += this.decoder.end();
    this.ended = true;
  }

  /**
   * A version of startsWith that isn't overriden by a broken version of ms-python.
   *
   * The definition comes from
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
   * which is CC0/public domain
   *
   * See https://github.com/github/vscode-codeql/issues/802 for more context as to why we need it.
   */
  private static startsWith(
    s: string,
    searchString: string,
    position: number,
  ): boolean {
    const pos = position > 0 ? position | 0 : 0;
    return s.substring(pos, pos + searchString.length) === searchString;
  }

  /**
   * Extract the next full line from the buffer, if one is available.
   * @returns The text of the next available full line (without the separator), or `undefined` if no
   * line is available.
   */
  public getNextLine(): string | undefined {
    // If we haven't received all of the input yet, don't search too close to the end of the buffer,
    // or we could match a separator that's split across two chunks. For example, we could see "\r"
    // at the end of the buffer and match that, even though we were about to receive a "\n" right
    // after it.
    const maxSearchIndex = this.ended
      ? this.buffer.length - 1
      : this.buffer.length - this.maxSeparatorLength;
    while (this.searchIndex <= maxSearchIndex) {
      for (const separator of this.separators) {
        if (SplitBuffer.startsWith(this.buffer, separator, this.searchIndex)) {
          const line = this.buffer.slice(0, this.searchIndex);
          this.buffer = this.buffer.slice(this.searchIndex + separator.length);
          this.searchIndex = 0;
          return line;
        }
      }
      this.searchIndex++;
    }

    if (this.ended && this.buffer.length > 0) {
      // If we still have some text left in the buffer, return it as the last line.
      const line = this.buffer;
      this.buffer = "";
      this.searchIndex = 0;
      return line;
    } else {
      return undefined;
    }
  }
}

/**
 * Splits a text stream into lines based on a list of valid line separators.
 * @param stream The text stream to split. This stream will be fully consumed.
 * @param separators The list of strings that act as line separators.
 * @returns A sequence of lines (not including separators).
 */
export async function* splitStreamAtSeparators(
  stream: Readable,
  separators: string[],
): AsyncGenerator<string, void, unknown> {
  const buffer = new SplitBuffer(separators);
  for await (const chunk of stream) {
    buffer.addChunk(chunk);
    let line: string | undefined;
    do {
      line = buffer.getNextLine();
      if (line !== undefined) {
        yield line;
      }
    } while (line !== undefined);
  }
  buffer.end();
  let line: string | undefined;
  do {
    line = buffer.getNextLine();
    if (line !== undefined) {
      yield line;
    }
  } while (line !== undefined);
}

/**
 *  Standard line endings for splitting human-readable text.
 */
export const LINE_ENDINGS = ["\r\n", "\r", "\n"];
