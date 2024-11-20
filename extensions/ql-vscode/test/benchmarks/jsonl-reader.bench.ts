/**
 * Benchmarks the jsonl-parser against a reference implementation and checks that it generates
 * the same output.
 *
 * Usage:
 *
 *   ts-node json-reader.bench.ts [evaluator-log.summary.jsonl] [count]
 *
 * The log file defaults to a small checked-in log and count defaults to 100
 * (and should be lowered significantly for large files).
 *
 * At the time of writing it is about as fast as the synchronous reference implementation,
 * but doesn't run out of memory for large files.
 */
import { readFile } from "fs-extra";
import { readJsonlFile } from "../../src/common/jsonl-reader";
import { performance } from "perf_hooks";
import { join } from "path";

/** An "obviously correct" implementation to test against. */
async function readJsonlReferenceImpl<T>(
  path: string,
  handler: (value: T) => Promise<void>,
): Promise<void> {
  const logSummary = await readFile(path, "utf-8");

  // Remove newline delimiters because summary is in .jsonl format.
  const jsonSummaryObjects: string[] = logSummary.split(/\r?\n\r?\n/g);

  for (const obj of jsonSummaryObjects) {
    const jsonObj = JSON.parse(obj) as T;
    await handler(jsonObj);
  }
}

type ParserFn = (
  text: string,
  callback: (v: unknown) => Promise<void>,
) => Promise<void>;

const parsers: Record<string, ParserFn> = {
  readJsonlReferenceImpl,
  readJsonlFile,
};

async function main() {
  const args = process.argv.slice(2);
  const file =
    args.length > 0
      ? args[0]
      : join(
          __dirname,
          "../unit-tests/data/evaluator-log-summaries/bad-join-order.jsonl",
        );
  const numTrials = args.length > 1 ? Number(args[1]) : 100;
  const referenceValues: any[] = [];
  await readJsonlReferenceImpl(file, async (event) => {
    referenceValues.push(event);
  });
  const referenceValueString = JSON.stringify(referenceValues);
  // Do warm-up runs and check against reference implementation
  for (const [name, parser] of Object.entries(parsers)) {
    const values: unknown[] = [];
    await parser(file, async (event) => {
      values.push(event);
    });
    if (JSON.stringify(values) !== referenceValueString) {
      console.error(`${name}: failed to match reference implementation`);
    }
  }
  for (const [name, parser] of Object.entries(parsers)) {
    const startTime = performance.now();
    for (let i = 0; i < numTrials; ++i) {
      await Promise.all([
        parser(file, async () => {}),
        parser(file, async () => {}),
      ]);
    }
    const duration = performance.now() - startTime;
    const durationPerTrial = duration / numTrials;
    console.log(`${name}: ${durationPerTrial.toFixed(1)} ms`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
});
