import { createReadStream, writeFile } from "fs-extra";
import { LINE_ENDINGS, splitStreamAtSeparators } from "../common/split-stream";

/**
 * Location information for a single pipeline invocation in the RA.
 */
export interface PipelineInfo {
  startLine: number;
  raStartLine: number;
  raEndLine: number;
}

/**
 * Location information for a single predicate in the RA.
 */
interface PredicateSymbol {
  /**
   * `PipelineInfo` for each iteration. A non-recursive predicate will have a single iteration `0`.
   */
  iterations: Record<number, PipelineInfo>;
}

/**
 * Location information for the RA from an evaluation log. Line numbers point into the
 * human-readable log summary.
 */
export interface SummarySymbols {
  predicates: Record<string, PredicateSymbol>;
}

// Tuple counts for Expr::Expr::getParent#dispred#f0820431#ff@76d6745o:
const NON_RECURSIVE_TUPLE_COUNT_REGEXP =
  /^Evaluated relational algebra for predicate (?<predicateName>\S+) with tuple counts:$/;
// Tuple counts for Expr::Expr::getEnclosingStmt#f0820431#bf@923ddwj9 on iteration 0 running pipeline base:
const RECURSIVE_TUPLE_COUNT_REGEXP =
  /^Evaluated relational algebra for predicate (?<predicateName>\S+) on iteration (?<iteration>\d+) running pipeline (?<pipeline>\S+) with tuple counts:$/;
const RETURN_REGEXP = /^\s*return /;

/**
 * Parse a human-readable evaluation log summary to find the location of the RA for each pipeline
 * run.
 *
 * TODO: Once we're more certain about the symbol format, we should have the CLI generate this as it
 * generates the human-readabe summary to avoid having to rely on regular expression matching of the
 * human-readable text.
 *
 * @param summaryPath The path to the summary file.
 * @param symbolsPath The path to the symbols file to generate.
 */
export async function generateSummarySymbolsFile(
  summaryPath: string,
  symbolsPath: string,
): Promise<void> {
  const symbols = await generateSummarySymbols(summaryPath);
  await writeFile(symbolsPath, JSON.stringify(symbols));
}

/**
 * Parse a human-readable evaluation log summary to find the location of the RA for each pipeline
 * run.
 *
 * @param fileLocation The path to the summary file.
 * @returns Symbol information for the summary file.
 */
async function generateSummarySymbols(
  summaryPath: string,
): Promise<SummarySymbols> {
  const stream = createReadStream(summaryPath, {
    encoding: "utf-8",
  });
  try {
    const lines = splitStreamAtSeparators(stream, LINE_ENDINGS);

    const symbols: SummarySymbols = {
      predicates: {},
    };

    let lineNumber = 0;
    let raStartLine = 0;
    let iteration = 0;
    let predicateName: string | undefined = undefined;
    let startLine = 0;
    for await (const line of lines) {
      if (predicateName === undefined) {
        // Looking for the start of the predicate.
        const nonRecursiveMatch = line.match(NON_RECURSIVE_TUPLE_COUNT_REGEXP);
        if (nonRecursiveMatch) {
          iteration = 0;
          predicateName = nonRecursiveMatch.groups!.predicateName;
        } else {
          const recursiveMatch = line.match(RECURSIVE_TUPLE_COUNT_REGEXP);
          if (recursiveMatch?.groups) {
            predicateName = recursiveMatch.groups.predicateName;
            iteration = parseInt(recursiveMatch.groups.iteration);
          }
        }
        if (predicateName !== undefined) {
          startLine = lineNumber;
          raStartLine = lineNumber + 1;
        }
      } else {
        const returnMatch = line.match(RETURN_REGEXP);
        if (returnMatch) {
          let symbol = symbols.predicates[predicateName];
          if (symbol === undefined) {
            symbol = {
              iterations: {},
            };
            symbols.predicates[predicateName] = symbol;
          }
          symbol.iterations[iteration] = {
            startLine,
            raStartLine,
            raEndLine: lineNumber,
          };

          predicateName = undefined;
        }
      }

      lineNumber++;
    }

    return symbols;
  } finally {
    stream.close();
  }
}
