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
      signature: "org.sql2o.Sql2o#open1()",
    });
    const negativeAutoModelPrediction = createMethod({
      signature: "org.sql2o.Sql2o#open2()",
    });
    const unsavedManualModel = createMethod({
      signature: "org.sql2o.Sql2o#open3()",
    });
    const unmodeledMethod = createMethod({
      signature: "org.sql2o.Sql2o#open4()",
    });
    const savedAutoModelPrediction = createMethod({
      signature: "org.sql2o.Sql2o#open5()",
    });
    const savedManualModel = createMethod({
      signature: "org.sql2o.Sql2o#open6()",
    });

    const methods: Method[] = shuffle([
      unsavedPositiveAutoModelPrediction,
      negativeAutoModelPrediction,
      unsavedManualModel,
      unmodeledMethod,
      savedAutoModelPrediction,
      savedManualModel,
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
      unsavedManualModel,
      unmodeledMethod,
      savedAutoModelPrediction,
      savedManualModel,
    ]);
  });

  it("uses secondary sort order based on usages and signature", () => {
    const negativeAutoModelPrediction = createMethod({
      signature: "org.sql2o.Sql2o#negative()",
      usages: [],
    });

    const unmodeledMethodWithTwoUsages = createMethod({
      signature: "org.sql2o.Sql2o#two()",
      usages: [createUsage(), createUsage()],
    });
    const unmodeledMethodWithOneUsage = createMethod({
      signature: "org.sql2o.Sql2o#one()",
      usages: [createUsage()],
    });

    const unmodeledMethodWithEarlierSignature = createMethod({
      signature: "org.sql2o.Sql2o#aaa()",
      usages: [],
    });
    const unmodeledMethodWithLaterSignature = createMethod({
      signature: "org.sql2o.Sql2o#bbb()",
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
