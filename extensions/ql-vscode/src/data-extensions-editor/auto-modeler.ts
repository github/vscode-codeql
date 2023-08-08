import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod } from "./modeled-method";
import { extLogger } from "../common/logging/vscode";
import { load as loadYaml } from "js-yaml";
import { withProgress } from "../common/vscode/progress";
import { createAutoModelV2Request, getCandidates } from "./auto-model-v2";
import { runAutoModelQueries } from "./auto-model-codeml-queries";
import { loadDataExtensionYaml } from "./yaml";
import { ModelRequest, ModelResponse, autoModelV2 } from "./auto-model-api-v2";
import { RequestError } from "@octokit/request-error";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { redactableError } from "../common/errors";
import { App } from "../common/app";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { QueryRunner } from "../query-server";
import { DatabaseItem } from "../databases/local-databases";
import { Mode } from "./shared/mode";

export class AutoModeler {
  constructor(
    private readonly app: App,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    private readonly queryStorageDir: string,
    private readonly databaseItem: DatabaseItem,
    private readonly addModeledMethods: (
      modeledMethods: Record<string, ModeledMethod>,
    ) => Promise<void>,
  ) {}

  public async startModeling(
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
    mode: Mode,
  ): Promise<void> {
    await this.model(externalApiUsages, modeledMethods, mode);
  }

  private async model(
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
    mode: Mode,
  ): Promise<void> {
    await withProgress(async (progress) => {
      const maxStep = 3000;

      progress({
        step: 0,
        maxStep,
        message: "Retrieving usages",
      });

      // Fetch the candidates to send to the model
      const candidateMethods = getCandidates(
        mode,
        externalApiUsages,
        modeledMethods,
      );

      // If there are no candidates, there is nothing to model and we just return
      if (candidateMethods.length === 0) {
        void extLogger.log("No candidates to model. Stopping.");
        return;
      }

      const usages = await runAutoModelQueries({
        mode,
        candidateMethods,
        cliServer: this.cliServer,
        queryRunner: this.queryRunner,
        queryStorageDir: this.queryStorageDir,
        databaseItem: this.databaseItem,
        progress: (update) => progress({ ...update, maxStep }),
      });
      if (!usages) {
        return;
      }

      progress({
        step: 1800,
        maxStep,
        message: "Creating request",
      });

      const request = await createAutoModelV2Request(mode, usages);

      progress({
        step: 2000,
        maxStep,
        message: "Sending request",
      });

      const response = await this.callAutoModelApi(request);
      if (!response) {
        return;
      }

      progress({
        step: 2500,
        maxStep,
        message: "Parsing response",
      });

      const models = loadYaml(response.models, {
        filename: "auto-model.yml",
      });

      const loadedMethods = loadDataExtensionYaml(models);
      if (!loadedMethods) {
        return;
      }

      // Any candidate that was part of the response is a negative result
      // meaning that the canidate is not a sink for the kinds that the LLM is checking for.
      // For now we model this as a sink neutral method, however this is subject
      // to discussion.
      for (const candidate of candidateMethods) {
        if (!(candidate.signature in loadedMethods)) {
          loadedMethods[candidate.signature] = {
            type: "neutral",
            kind: "sink",
            input: "",
            output: "",
            provenance: "ai-generated",
            signature: candidate.signature,
            packageName: candidate.packageName,
            typeName: candidate.typeName,
            methodName: candidate.methodName,
            methodParameters: candidate.methodParameters,
          };
        }
      }

      progress({
        step: 2800,
        maxStep,
        message: "Applying results",
      });

      await this.addModeledMethods(loadedMethods);
    });
  }

  private async callAutoModelApi(
    request: ModelRequest,
  ): Promise<ModelResponse | null> {
    try {
      return await autoModelV2(this.app.credentials, request);
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
