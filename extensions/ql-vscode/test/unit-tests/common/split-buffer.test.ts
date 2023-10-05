import { LINE_ENDINGS, SplitBuffer } from "../../../src/common/split-stream";

interface Chunk {
  chunk: string;
  lines: string[];
}

function checkLines(
  buffer: SplitBuffer,
  expectedLinesForChunk: string[],
  chunkIndex: number | "end",
): void {
  expectedLinesForChunk.forEach((expectedLine, lineIndex) => {
    const line = buffer.getNextLine();
    const location = `[chunk ${chunkIndex}, line ${lineIndex}]: `;
    expect(location + line).toEqual(location + expectedLine);
  });
  expect(buffer.getNextLine()).toBeUndefined();
}

function testSplitBuffer(chunks: Chunk[], endLines: string[]): void {
  const buffer = new SplitBuffer(LINE_ENDINGS);
  chunks.forEach((chunk, chunkIndex) => {
    buffer.addChunk(Buffer.from(chunk.chunk, "utf-8"));
    checkLines(buffer, chunk.lines, chunkIndex);
  });
  buffer.end();
  checkLines(buffer, endLines, "end");
}

describe("split buffer", () => {
  it("should handle a one-chunk string with no terminator", async () => {
    // Won't return the line until we call `end()`.
    testSplitBuffer([{ chunk: "some text", lines: [] }], ["some text"]);
  });

  it("should handle a one-chunk string with a one-byte terminator", async () => {
    // Won't return the line until we call `end()` because the actual terminator is shorter than the
    // longest terminator.
    testSplitBuffer([{ chunk: "some text\n", lines: [] }], ["some text"]);
  });

  it("should handle a one-chunk string with a two-byte terminator", async () => {
    testSplitBuffer([{ chunk: "some text\r\n", lines: ["some text"] }], []);
  });

  it("should handle a multi-chunk string with terminators at the end of each chunk", async () => {
    testSplitBuffer(
      [
        { chunk: "first line\n", lines: [] }, // Waiting for second potential terminator byte
        { chunk: "second line\r", lines: ["first line"] }, // Waiting for second potential terminator byte
        { chunk: "third line\r\n", lines: ["second line", "third line"] }, // No wait, because we're at the end
      ],
      [],
    );
  });

  it("should handle a multi-chunk string with terminators at random offsets", async () => {
    testSplitBuffer(
      [
        { chunk: "first line\nsecond", lines: ["first line"] },
        {
          chunk: " line\rthird line",
          lines: ["second line"],
        },
        { chunk: "\r\n", lines: ["third line"] },
      ],
      [],
    );
  });

  it("should handle a terminator split between chunks", async () => {
    testSplitBuffer(
      [
        { chunk: "first line\r", lines: [] },
        {
          chunk: "\nsecond line",
          lines: ["first line"],
        },
      ],
      ["second line"],
    );
  });
});
