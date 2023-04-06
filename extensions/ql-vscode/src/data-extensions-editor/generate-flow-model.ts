import { CancellationToken } from "vscode";
import { DatabaseItem } from "../local-databases";
import { join } from "path";
import { QueryRunner } from "../queryRunner";
import { CodeQLCliServer } from "../cli";
import { extLogger, TeeLogger } from "../common";
import { extensiblePredicateDefinitions } from "./yaml";
import { ProgressCallback } from "../progress";
import { getOnDiskWorkspaceFolders } from "../helpers";
import {
  ModeledMethodType,
  ModeledMethodWithSignature,
} from "./modeled-method";

class FlowModelGenerator {
  constructor(
    private readonly cli: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    private readonly queryStorageDir: string,
    private readonly qlDir: string,
    private readonly databaseItem: DatabaseItem,
    private readonly progress: ProgressCallback,
    private readonly token: CancellationToken,
  ) {}

  async getAddsTo(
    type: Exclude<ModeledMethodType, "none">,
    queryName: string,
    queryStep: number,
  ): Promise<ModeledMethodWithSignature[] | undefined> {
    const definition = extensiblePredicateDefinitions[type];

    const query = join(
      this.qlDir,
      this.databaseItem.language,
      "ql/src/utils/modelgenerator",
      queryName,
    );

    const queryRun = this.queryRunner.createQueryRun(
      this.databaseItem.databaseUri.fsPath,
      { queryPath: query, quickEvalPosition: undefined },
      false,
      getOnDiskWorkspaceFolders(),
      undefined,
      this.queryStorageDir,
      undefined,
      undefined,
    );

    const queryResult = await queryRun.evaluate(
      ({ step, message }) =>
        this.progress({
          message: `Generating ${type} model: ${message}`,
          step: queryStep * 1000 + step,
          maxStep: 4000,
        }),
      this.token,
      new TeeLogger(this.queryRunner.logger, queryRun.outputDir.logPath),
    );

    const bqrsPath = queryResult.outputDir.bqrsPath;

    const bqrsInfo = await this.cli.bqrsInfo(bqrsPath);
    if (bqrsInfo["result-sets"].length !== 1) {
      void extLogger.log(
        `Expected exactly one result set, got ${bqrsInfo["result-sets"].length}`,
      );
      return undefined;
    }

    const resultSet = bqrsInfo["result-sets"][0];

    const decodedResults = await this.cli.bqrsDecode(bqrsPath, resultSet.name);

    const results = decodedResults.tuples;

    return results.map((result) => {
      const row = result[0] as string;

      return definition.readModeledMethod(row.split(";"));
    });
  }

  async run(
    onResults: (results: ModeledMethodWithSignature[]) => void | Promise<void>,
  ) {
    const summaryResults = await this.getAddsTo(
      "summary",
      "CaptureSummaryModels.ql",
      0,
    );
    if (summaryResults) {
      await onResults(summaryResults);
    }

    const sinkResults = await this.getAddsTo("sink", "CaptureSinkModels.ql", 1);
    if (sinkResults) {
      await onResults(sinkResults);
    }

    const sourceResults = await this.getAddsTo(
      "source",
      "CaptureSourceModels.ql",
      2,
    );
    if (sourceResults) {
      await onResults(sourceResults);
    }

    const neutralResults = await this.getAddsTo(
      "neutral",
      "CaptureNeutralModels.ql",
      3,
    );
    if (neutralResults) {
      await onResults(neutralResults);
    }
  }
}

export async function generateFlowModel(
  cli: CodeQLCliServer,
  queryRunner: QueryRunner,
  queryStorageDir: string,
  qlDir: string,
  databaseItem: DatabaseItem,
  onResults: (results: ModeledMethodWithSignature[]) => void | Promise<void>,
  progress: ProgressCallback,
  token: CancellationToken,
) {
  const generator = new FlowModelGenerator(
    cli,
    queryRunner,
    queryStorageDir,
    qlDir,
    databaseItem,
    progress,
    token,
  );

  return generator.run(onResults);
}
