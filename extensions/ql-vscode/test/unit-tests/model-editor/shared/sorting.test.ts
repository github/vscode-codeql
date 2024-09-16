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
    const unsavedModel = createMethod({
      signature: "org.sql2o.Sql2o#unsavedModel()",
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
    const savedModel = createMethod({
      signature: "org.sql2o.Sql2o#savedModel()",
      supported: false,
    });
    const supportedMethod = createMethod({
      signature: "org.sql2o.Sql2o#supportedMethod()",
      supported: true,
    });

    const methods: Method[] = shuffle([
      unsavedModel,
      unmodeledMethodWithEarlierSignature,
      unmodeledMethodWithLaterSignature,
      savedModel,
      supportedMethod,
    ]);

    const modeledMethodsMap: Record<string, readonly ModeledMethod[]> = {};
    modeledMethodsMap[unsavedModel.signature] = [createSinkModeledMethod()];
    modeledMethodsMap[savedModel.signature] = [createSinkModeledMethod()];

    const modifiedSignatures: Set<string> = new Set([unsavedModel.signature]);

    expect(sortMethods(methods, modeledMethodsMap, modifiedSignatures)).toEqual(
      [
        unmodeledMethodWithEarlierSignature,
        unsavedModel,
        unmodeledMethodWithLaterSignature,
        savedModel,
        supportedMethod,
      ],
    );
  });

  it("uses secondary sort order based on usages and signature", () => {
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
      unmodeledMethodWithTwoUsages,
      unmodeledMethodWithOneUsage,
      unmodeledMethodWithEarlierSignature,
      unmodeledMethodWithLaterSignature,
    ]);

    const modeledMethodsMap: Record<string, readonly ModeledMethod[]> = {};

    const modifiedSignatures: Set<string> = new Set([]);

    expect(sortMethods(methods, modeledMethodsMap, modifiedSignatures)).toEqual(
      [
        unmodeledMethodWithTwoUsages,
        unmodeledMethodWithOneUsage,
        unmodeledMethodWithEarlierSignature,
        unmodeledMethodWithLaterSignature,
      ],
    );
  });
});
