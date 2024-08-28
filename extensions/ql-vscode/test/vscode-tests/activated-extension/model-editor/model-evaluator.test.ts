import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { App } from "../../../../src/common/app";
import type { NotificationLogger } from "../../../../src/common/logging";
import { QueryLanguage } from "../../../../src/common/query-language";
import type { DatabaseItem } from "../../../../src/databases/local-databases";
import type { ModelEvaluationRun } from "../../../../src/model-editor/model-evaluation-run";
import { ModelEvaluator } from "../../../../src/model-editor/model-evaluator";
import { ModelingEvents } from "../../../../src/model-editor/modeling-events";
import type { ModelingStore } from "../../../../src/model-editor/modeling-store";
import type { ExtensionPack } from "../../../../src/model-editor/shared/extension-pack";
import type { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import { createMockApp } from "../../../__mocks__/appMock";
import { createMockLogger } from "../../../__mocks__/loggerMock";
import { createMockModelingStore } from "../../../__mocks__/model-editor/modelingStoreMock";
import { mockedObject } from "../../../mocked-object";

const SETUP_TIMEOUT = 20_000;

describe("Model Evaluator", () => {
  let modelEvaluator: ModelEvaluator;
  let logger: NotificationLogger;
  let app: App;
  let cliServer: CodeQLCliServer;
  let modelingStore: ModelingStore;
  let modelingEvents: ModelingEvents;
  let variantAnalysisManager: VariantAnalysisManager;
  let dbItem: DatabaseItem;
  let language: QueryLanguage;
  let extensionPack: ExtensionPack;
  let updateView: jest.Mock;
  let getModelEvaluationRunMock = jest.fn();

  beforeEach(() => {
    logger = createMockLogger();
    app = createMockApp({ logger });
    cliServer = mockedObject<CodeQLCliServer>({});
    getModelEvaluationRunMock = jest.fn();
    modelingStore = createMockModelingStore({
      getModelEvaluationRun: getModelEvaluationRunMock,
    });
    modelingEvents = new ModelingEvents(app);
    variantAnalysisManager = mockedObject<VariantAnalysisManager>({
      cancelVariantAnalysis: jest.fn(),
    });
    dbItem = mockedObject<DatabaseItem>({});
    language = QueryLanguage.Java;
    extensionPack = mockedObject<ExtensionPack>({});
    updateView = jest.fn();

    modelEvaluator = new ModelEvaluator(
      app,
      cliServer,
      modelingStore,
      modelingEvents,
      variantAnalysisManager,
      dbItem,
      language,
      extensionPack,
      updateView,
    );
  }, SETUP_TIMEOUT);

  describe("stopping evaluation", () => {
    it("should just log a message if it never started", async () => {
      getModelEvaluationRunMock.mockReturnValue(undefined);

      await modelEvaluator.stopEvaluation();

      expect(logger.log).toHaveBeenCalledWith(
        "No active evaluation run to stop",
      );
    });

    it("should update the store if evaluation run exists", async () => {
      getModelEvaluationRunMock.mockReturnValue({
        isPreparing: true,
        variantAnalysisId: undefined,
      });

      await modelEvaluator.stopEvaluation();

      expect(modelingStore.updateModelEvaluationRun).toHaveBeenCalledWith(
        dbItem,
        {
          isPreparing: false,
          varianAnalysis: undefined,
        },
      );
    });

    it("should cancel the variant analysis if one has been started", async () => {
      const evaluationRun: ModelEvaluationRun = {
        isPreparing: false,
        variantAnalysisId: 123,
      };
      getModelEvaluationRunMock.mockReturnValue(evaluationRun);

      await modelEvaluator.stopEvaluation();

      expect(modelingStore.updateModelEvaluationRun).not.toHaveBeenCalled();
      expect(variantAnalysisManager.cancelVariantAnalysis).toHaveBeenCalledWith(
        evaluationRun.variantAnalysisId,
      );
    });
  });
});
