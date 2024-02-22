import type { Method } from "../../../../src/model-editor/method";
import type { ModeledMethod } from "../../../../src/model-editor/modeled-method";
import { sortMethods } from "../../../../src/model-editor/shared/sorting";
import {
  createMethod,
  createUsage,
} from "../../../factories/model-editor/method-factories";
import { createSinkModeledMethod } from "../../../factories/model-editor/modeled-method-factories";
import { shuffle } from "../../../vscode-tests/utils/list-helpers";

describe("sortMethods", () => {
  it("uses primary sort order", () => {
    const unsavedPositiveAutoModelPrediction = createMethod({
      signature: "org.sql2o.Sql2o#unsavedPositiveAutoModelPrediction()",
      supported: false,
    });
    const negativeAutoModelPrediction = createMethod({
      signature: "org.sql2o.Sql2o#negativeAutoModelPrediction()",
      supported: false,
    });
    const unsavedManualModel = createMethod({
      signature: "org.sql2o.Sql2o#unsavedManualModel()",
      supported: false,
    });
    const unmodeledMethodWithEarlierSignature = createMethod({
      signature: "org.sql2o.Sql2o#aaa_unmodeledMethodWithEarlierSignature()",
      supported: false,
    });
    const unmodeledMethodWithLaterSignature = createMethod({
      signature: "org.sql2o.Sql2o#zzz_unmodeledMethodWithLaterSignature()",
      supported: false,
    });
    const savedAutoModelPrediction = createMethod({
      signature: "org.sql2o.Sql2o#savedAutoModelPrediction()",
      supported: false,
    });
    const savedManualModel = createMethod({
      signature: "org.sql2o.Sql2o#savedManualModel()",
      supported: false,
    });
    const supportedMethod = createMethod({
      signature: "org.sql2o.Sql2o#supportedMethod()",
      supported: true,
    });

    const methods: Method[] = shuffle([
      unsavedPositiveAutoModelPrediction,
      negativeAutoModelPrediction,
      unsavedManualModel,
      unmodeledMethodWithEarlierSignature,
      unmodeledMethodWithLaterSignature,
      savedAutoModelPrediction,
      savedManualModel,
      supportedMethod,
    ]);

    const modeledMethodsMap: Record<string, readonly ModeledMethod[]> = {};
    modeledMethodsMap[unsavedPositiveAutoModelPrediction.signature] = [
      createSinkModeledMethod(),
    ];
    modeledMethodsMap[unsavedManualModel.signature] = [
      createSinkModeledMethod(),
    ];
    modeledMethodsMap[savedAutoModelPrediction.signature] = [
      createSinkModeledMethod(),
    ];
    modeledMethodsMap[savedManualModel.signature] = [createSinkModeledMethod()];

    const modifiedSignatures: Set<string> = new Set([
      unsavedPositiveAutoModelPrediction.signature,
      unsavedManualModel.signature,
    ]);

    const processedByAutoModelMethods: Set<string> = new Set([
      unsavedPositiveAutoModelPrediction.signature,
      negativeAutoModelPrediction.signature,
      savedAutoModelPrediction.signature,
    ]);

    expect(
      sortMethods(
        methods,
        modeledMethodsMap,
        modifiedSignatures,
        processedByAutoModelMethods,
      ),
    ).toEqual([
      unsavedPositiveAutoModelPrediction,
      negativeAutoModelPrediction,
      unmodeledMethodWithEarlierSignature,
      unsavedManualModel,
      unmodeledMethodWithLaterSignature,
      savedAutoModelPrediction,
      savedManualModel,
      supportedMethod,
    ]);
  });

  it("uses secondary sort order based on usages and signature", () => {
    const negativeAutoModelPrediction = createMethod({
      signature: "org.sql2o.Sql2o#negativeAutoModelPrediction()",
      supported: false,
      usages: [],
    });

    const unmodeledMethodWithTwoUsages = createMethod({
      signature: "org.sql2o.Sql2o#unmodeledMethodWithTwoUsages()",
      supported: false,
      usages: [createUsage(), createUsage()],
    });
    const unmodeledMethodWithOneUsage = createMethod({
      signature: "org.sql2o.Sql2o#unmodeledMethodWithOneUsage()",
      supported: false,
      usages: [createUsage()],
    });

    const unmodeledMethodWithEarlierSignature = createMethod({
      signature: "org.sql2o.Sql2o#aaa_unmodeledMethodWithEarlierSignature()",
      supported: false,
      usages: [],
    });
    const unmodeledMethodWithLaterSignature = createMethod({
      signature: "org.sql2o.Sql2o#bbb_unmodeledMethodWithLaterSignature()",
      supported: false,
      usages: [],
    });

    const methods: Method[] = shuffle([
      negativeAutoModelPrediction,
      unmodeledMethodWithTwoUsages,
      unmodeledMethodWithOneUsage,
      unmodeledMethodWithEarlierSignature,
      unmodeledMethodWithLaterSignature,
    ]);

    const modeledMethodsMap: Record<string, readonly ModeledMethod[]> = {};

    const modifiedSignatures: Set<string> = new Set([]);

    const processedByAutoModelMethods: Set<string> = new Set([
      negativeAutoModelPrediction.signature,
    ]);

    expect(
      sortMethods(
        methods,
        modeledMethodsMap,
        modifiedSignatures,
        processedByAutoModelMethods,
      ),
    ).toEqual([
      negativeAutoModelPrediction,
      unmodeledMethodWithTwoUsages,
      unmodeledMethodWithOneUsage,
      unmodeledMethodWithEarlierSignature,
      unmodeledMethodWithLaterSignature,
    ]);
  });
});
