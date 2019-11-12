export interface StreamReader extends AsyncIterable<Uint8Array> {
  dispose(): void;
}

export interface RandomAccessReader {
  readStream(start?: number, end?: number): StreamReader;
  dispose(): void;
}
