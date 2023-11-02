import { Method, MethodSignature } from "./method";
import { ModeledMethod } from "./modeled-method";
import { load as loadYaml } from "js-yaml";
import { ProgressCallback, withProgress } from "../common/vscode/progress";
import { createAutoModelRequest, getCandidates } from "./auto-model";
import { runAutoModelQueries } from "./auto-model-codeml-queries";
import { loadDataExtensionYaml } from "./yaml";
import { ModelRequest, ModelResponse, autoModel } from "./auto-model-api";
import { RequestError } from "@octokit/request-error";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { redactableError } from "../common/errors";
import { App } from "../common/app";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { QueryRunner } from "../query-server";
import { DatabaseItem } from "../databases/local-databases";
import { Mode } from "./shared/mode";
import { CancellationTokenSource } from "vscode";
import { ModelingStore } from "./modeling-store";
import { ModelConfigListener } from "../config";
import { QueryLanguage } from "../common/query-language";

/**
 * The auto-modeler holds state around auto-modeling jobs and allows
 * starting and stopping them.
 */
export class AutoModeler {
  // Keep track of auto-modeling jobs that are in progress
  // so that we can stop them.
  private readonly jobs: Map<string, CancellationTokenSource>;

  constructor(
    private readonly app: App,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    private readonly modelConfig: ModelConfigListener,
    private readonly modelingStore: ModelingStore,
    private readonly queryStorageDir: string,
    private readonly databaseItem: DatabaseItem,
    private readonly language: QueryLanguage,
    private readonly addModeledMethods: (
      modeledMethods: Record<string, ModeledMethod[]>,
    ) => Promise<void>,
  ) {
    this.jobs = new Map<string, CancellationTokenSource>();
  }

  /**
   * Models the given package's external API usages, except
   * the ones that are already modeled.
   * @param packageName The name of the package to model.
   * @param methods The methods.
   * @param modeledMethods The currently modeled methods.
   * @param mode The mode we are modeling in.
   */
  public async startModeling(
    packageName: string,
    methods: readonly Method[],
    modeledMethods: Record<string, readonly ModeledMethod[]>,
    mode: Mode,
  ): Promise<void> {
    if (this.jobs.has(packageName)) {
      return;
    }

    const cancellationTokenSource = new CancellationTokenSource();
    this.jobs.set(packageName, cancellationTokenSource);

    try {
      await this.modelPackage(
        packageName,
        methods,
        modeledMethods,
        mode,
        cancellationTokenSource,
      );
    } finally {
      this.jobs.delete(packageName);
    }
  }

  /**
   * Stops modeling the given package.
   * @param packageName The name of the package to stop modeling.
   */
  public async stopModeling(packageName: string): Promise<void> {
    void this.app.logger.log(`Stopping modeling for package ${packageName}`);
    const cancellationTokenSource = this.jobs.get(packageName);
    if (cancellationTokenSource) {
      cancellationTokenSource.cancel();
    }
  }

  /**
   * Stops all in-progress modeling jobs.
   */
  public async stopAllModeling(): Promise<void> {
    for (const cancellationTokenSource of this.jobs.values()) {
      cancellationTokenSource.cancel();
    }
  }

  private async modelPackage(
    packageName: string,
    methods: readonly Method[],
    modeledMethods: Record<string, readonly ModeledMethod[]>,
    mode: Mode,
    cancellationTokenSource: CancellationTokenSource,
  ): Promise<void> {
    void this.app.logger.log(`Modeling package ${packageName}`);

    const candidateBatchSize = this.modelConfig.llmGenerationBatchSize;

    await withProgress(async (progress) => {
      // Fetch the candidates to send to the model
      const allCandidateMethods = getCandidates(mode, methods, modeledMethods);

      // If there are no candidates, there is nothing to model and we just return
      if (allCandidateMethods.length === 0) {
        void this.app.logger.log("No candidates to model. Stopping.");
        return;
      }

      // Find number of slices to make
      const batchNumber = Math.ceil(
        allCandidateMethods.length / candidateBatchSize,
      );
      try {
        for (let i = 0; i < batchNumber; i++) {
          // Check if we should stop
          if (cancellationTokenSource.token.isCancellationRequested) {
            break;
          }

          const start = i * candidateBatchSize;
          const end = start + candidateBatchSize;
          const candidatesToProcess = allCandidateMethods.slice(start, end);
          const candidateSignatures = candidatesToProcess.map(
            (c) => c.signature,
          );

          // Let the UI know which candidates we are modeling
          this.modelingStore.addInProgressMethods(
            this.databaseItem,
            candidateSignatures,
          );

          // Kick off the process to model the slice of candidates
          await this.modelCandidates(
            candidatesToProcess,
            mode,
            progress,
            cancellationTokenSource,
          );

          // Let the UI know which candidates we are done modeling
          this.modelingStore.removeInProgressMethods(
            this.databaseItem,
            candidateSignatures,
          );
        }
      } finally {
        // Clear out in progress methods in case anything went wrong
        this.modelingStore.removeInProgressMethods(
          this.databaseItem,
          allCandidateMethods.map((c) => c.signature),
        );
      }
    });
  }

  private async modelCandidates(
    candidateMethods: MethodSignature[],
    mode: Mode,
    progress: ProgressCallback,
    cancellationTokenSource: CancellationTokenSource,
  ): Promise<void> {
    void this.app.logger.log("Executing auto-model queries");

    const usages = await runAutoModelQueries({
      mode,
      candidateMethods,
      cliServer: this.cliServer,
      queryRunner: this.queryRunner,
      queryStorageDir: this.queryStorageDir,
      databaseItem: this.databaseItem,
      progress: (update) => progress({ ...update }),
      cancellationTokenSource,
    });
    if (!usages) {
      return;
    }

    const request = await createAutoModelRequest(mode, usages);

    void this.app.logger.log("Calling auto-model API");

    const response = await this.callAutoModelApi(request);
    if (!response) {
      return;
    }

    const models = loadYaml(response.models, {
      filename: "auto-model.yml",
    });

    const loadedMethods = loadDataExtensionYaml(models, this.language);
    if (!loadedMethods) {
      return;
    }

    // Any candidate that was part of the response is a negative result
    // meaning that the canidate is not a sink for the kinds that the LLM is checking for.
    // For now we model this as a sink neutral method, however this is subject
    // to discussion.
    for (const candidate of candidateMethods) {
      if (!(candidate.signature in loadedMethods)) {
        loadedMethods[candidate.signature] = [
          {
            type: "neutral",
            kind: "sink",
            provenance: "ai-generated",
            signature: candidate.signature,
            packageName: candidate.packageName,
            typeName: candidate.typeName,
            methodName: candidate.methodName,
            methodParameters: candidate.methodParameters,
          },
        ];
      }
    }

    await this.addModeledMethods(loadedMethods);
  }

  private async callAutoModelApi(
    request: ModelRequest,
  ): Promise<ModelResponse | null> {
    try {
      return await autoModel(this.app.credentials, request, this.modelConfig);
    } catch (e) {
      if (e instanceof RequestError && e.status === 429) {
        void showAndLogExceptionWithTelemetry(
          this.app.logger,
          this.app.telemetry,
          redactableError(e)`Rate limit hit, please try again soon.`,
        );
        return null;
      } else {
        throw e;
      }
    }
  }
}
