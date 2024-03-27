import {
  createNoneModeledMethod,
  createSummaryModeledMethod,
} from "../../factories/model-editor/modeled-method-factories";
import type { ModeledMethod } from "../../../src/model-editor/modeled-method";
import {
  createModeledMethodKey,
  modeledMethodSupportsInput,
  modeledMethodSupportsKind,
  modeledMethodSupportsOutput,
  modeledMethodSupportsProvenance,
} from "../../../src/model-editor/modeled-method";

describe("modeledMethodSupportsKind", () => {
  const modeledMethod = createNoneModeledMethod() as ModeledMethod;

  it("can access the kind property", () => {
    // These are more type tests than unit tests, but they're still useful.
    if (modeledMethodSupportsKind(modeledMethod)) {
      expect(modeledMethod.kind).not.toBeUndefined(); // never hit
    }
  });
});

describe("modeledMethodSupportsInput", () => {
  const modeledMethod = createNoneModeledMethod() as ModeledMethod;

  it("can access the input property", () => {
    // These are more type tests than unit tests, but they're still useful.
    if (modeledMethodSupportsInput(modeledMethod)) {
      expect(modeledMethod.input).not.toBeUndefined(); // never hit
    }
  });
});

describe("modeledMethodSupportsOutput", () => {
  const modeledMethod = createNoneModeledMethod() as ModeledMethod;

  it("can access the output property", () => {
    // These are more type tests than unit tests, but they're still useful.
    if (modeledMethodSupportsOutput(modeledMethod)) {
      expect(modeledMethod.output).not.toBeUndefined(); // never hit
    }
  });
});

describe("modeledMethodSupportsProvenance", () => {
  const modeledMethod = createNoneModeledMethod() as ModeledMethod;

  it("can access the provenance property", () => {
    // These are more type tests than unit tests, but they're still useful.
    if (modeledMethodSupportsProvenance(modeledMethod)) {
      expect(modeledMethod.provenance).not.toBeUndefined();
    }
  });
});

describe("createModeledMethodKey", () => {
  it("should create a key for a modeled method", () => {
    const modeledMethod = createNoneModeledMethod();
    const key = createModeledMethodKey(modeledMethod);

    const expectedKey =
      '{"endpointType":"method","methodName":"createQuery","methodParameters":"(String)","packageName":"org.sql2o","signature":"org.sql2o.Connection#createQuery(String)","type":"none","typeName":"Connection"}';

    expect(key).toBe(expectedKey);
  });

  it("should check that two modeled methods are the same", () => {
    const modeledMethod = createSummaryModeledMethod();
    const key = createModeledMethodKey(modeledMethod);

    const modeledMethod2 = createSummaryModeledMethod();
    const key2 = createModeledMethodKey(modeledMethod2);

    // Object references are different, but the keys are the same.
    expect(modeledMethod === modeledMethod2).toBe(false);
    expect(key === key2).toBe(true);
  });
});
