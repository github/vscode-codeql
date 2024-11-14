import { cpSync, createReadStream, mkdtempSync } from "fs";
import { join } from "path";
// eslint-disable-next-line import/no-namespace
import * as badnessMetrics from "./log-processors/badness-metrics";
// eslint-disable-next-line import/no-namespace
import * as expensivePredicates from "./log-processors/expensive-predicates";
// eslint-disable-next-line import/no-namespace
import * as logSummary from "./log-processors/log-summary";
// eslint-disable-next-line import/no-namespace
import * as stageTimings from "./log-processors/stage-timings";
// eslint-disable-next-line import/no-namespace
import * as tupleSums from "./log-processors/tuple-sums";
import { log } from "./util";

/**
 * Minimal CLI interface for running the evaluator log processing locally.
 *
 * Intended for use in development and debugging.
 * This is not intended to be a full-featured CLI tool, nor as a replacement for ordinary testing.
 *
 * Sample use:
 *
 * ```
 * $ ts-node cli.ts badness-metrics codeql ~/Downloads/codeql-evaluator-log.json
 * ```
 */
async function main(args: string[]) {
  const positionals = args.filter((arg) => !arg.startsWith("--"));
  const [operation, codeqlPath, logPath] = positionals;
  const options = args.filter((arg) => arg.startsWith("--"));
  const verbose = options.includes("--verbose");
  const explicitOutputFile = options
    .find((arg) => arg.startsWith("--output="))
    ?.split("=")[1];
  const help = options.includes("--help");
  // dear future reader. Please consider using a proper CLI library instead of this ad hoc parsing.
  const usage = [
    "Usage: cli <badness-metrics|expensive-predicates|overall-summary|predicates-summary|stage-timings|tuple-sums> <codeql-path> <summary-log-path> [--verbose] [--output=<output-file>]",
  ].join("\n");

  if (help) {
    console.log(usage);
    return;
  }
  if (!operation || !codeqlPath || !logPath) {
    throw new Error(`Missing arguments.\n\n${usage}`);
  }
  async function makeSummaryLogFile(format: "overall" | "predicates") {
    const summaryLogFile = `${logPath}.${format}.log`;
    await logSummary.process(codeqlPath, logPath, summaryLogFile, format);
    return summaryLogFile;
  }

  const implicitOutputFile = join(
    mkdtempSync("log-insights-"),
    "implicit-output.txt",
  );
  const actualOutputFile = explicitOutputFile || implicitOutputFile;
  switch (operation) {
    case "badness-metrics":
      await badnessMetrics.process(
        codeqlPath,
        await makeSummaryLogFile("predicates"),
        actualOutputFile,
      );
      break;
    case "expensive-predicates":
      await expensivePredicates.process(
        codeqlPath,
        await makeSummaryLogFile("overall"),
        actualOutputFile,
      );
      break;
    case "overall-summary":
      await logSummary.process(
        codeqlPath,
        logPath,
        actualOutputFile,
        "overall",
      );
      break;
    case "predicates-summary": {
      await logSummary.process(
        codeqlPath,
        logPath,
        actualOutputFile,
        "predicates",
      );
      break;
    }
    case "text-summary": {
      await logSummary.process(codeqlPath, logPath, actualOutputFile, "text");
      break;
    }
    case "stage-timings":
      await stageTimings.process(
        codeqlPath,
        await makeSummaryLogFile("predicates"),
        actualOutputFile,
      );
      break;
    case "tuple-sums":
      await tupleSums.process(
        codeqlPath,
        await makeSummaryLogFile("predicates"),
        actualOutputFile,
      );
      break;
    default:
      throw new Error(`Unknown operation: ${operation}.\n\n${usage}`);
  }
  if (verbose) {
    createReadStream(actualOutputFile).pipe(process.stdout);
  }
  if (explicitOutputFile) {
    cpSync(actualOutputFile, explicitOutputFile);
  }
  log(`Output is available in ${actualOutputFile}.`);
}
void main(process.argv.slice(2));
