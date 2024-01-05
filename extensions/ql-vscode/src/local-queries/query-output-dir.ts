import { join } from "path";

function findQueryLogFile(resultPath: string): string {
  return join(resultPath, "query.log");
}

function findQueryEvalLogFile(resultPath: string): string {
  return join(resultPath, "evaluator-log.jsonl");
}

function findQueryEvalLogSummaryFile(resultPath: string): string {
  return join(resultPath, "evaluator-log.summary");
}

function findJsonQueryEvalLogSummaryFile(resultPath: string): string {
  return join(resultPath, "evaluator-log.summary.jsonl");
}

function findQueryEvalLogSummarySymbolsFile(resultPath: string): string {
  return join(resultPath, "evaluator-log.summary.symbols.json");
}

function findQueryEvalLogEndSummaryFile(resultPath: string): string {
  return join(resultPath, "evaluator-log-end.summary");
}

/**
 * Provides paths to the files that can be generated in the output directory for a query evaluation.
 */
export class QueryOutputDir {
  constructor(public readonly querySaveDir: string) {}

  get dilPath() {
    return join(this.querySaveDir, "results.dil");
  }

  /**
   * Get the path that the compiled query is if it exists. Note that it only exists when using the legacy query server.
   */
  get compileQueryPath() {
    return join(this.querySaveDir, "compiledQuery.qlo");
  }

  get csvPath() {
    return join(this.querySaveDir, "results.csv");
  }

  get logPath() {
    return findQueryLogFile(this.querySaveDir);
  }

  get evalLogPath() {
    return findQueryEvalLogFile(this.querySaveDir);
  }

  get evalLogSummaryPath() {
    return findQueryEvalLogSummaryFile(this.querySaveDir);
  }

  get jsonEvalLogSummaryPath() {
    return findJsonQueryEvalLogSummaryFile(this.querySaveDir);
  }

  get evalLogSummarySymbolsPath() {
    return findQueryEvalLogSummarySymbolsFile(this.querySaveDir);
  }

  get evalLogEndSummaryPath() {
    return findQueryEvalLogEndSummaryFile(this.querySaveDir);
  }

  get bqrsPath() {
    return join(this.querySaveDir, "results.bqrs");
  }
}
