import {
  createNeutralModeledMethod,
  createNoneModeledMethod,
  createSinkModeledMethod,
  createSourceModeledMethod,
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
    expect(modeledMethod).not.toBe(modeledMethod2);
    expect(key).toEqual(key2);
  });

  it("should always set provenance to manual", () => {
    const modeledMethod = createSinkModeledMethod({
      provenance: "df-generated",
    });
    const key = createModeledMethodKey(modeledMethod);

    expect(key).not.toContain('"provenance":"df-generated"');
    expect(key).toContain('"provenance":"manual"');
  });

  describe("ignores unused properties", () => {
    it("for source modeled methods", () => {
      const modeledMethod = createSourceModeledMethod({
        output: "ReturnValue",
        ...{
          input: "Argument[this]",
        },
      });
      const key = createModeledMethodKey(modeledMethod);

      const modeledMethod2 = createSourceModeledMethod({
        output: "ReturnValue",
        ...{
          input: "Argument[1]",
        },
      });
      const key2 = createModeledMethodKey(modeledMethod2);

      expect(key).not.toContain("input");
      expect(key).toEqual(key2);
    });

    it("for sink modeled methods", () => {
      const modeledMethod = createSinkModeledMethod({
        input: "Argument[this]",
        ...{
          output: "ReturnValue",
        },
      });
      const key = createModeledMethodKey(modeledMethod);

      const modeledMethod2 = createSinkModeledMethod({
        input: "Argument[this]",
        ...{
          output: "Argument[this]",
        },
      });
      const key2 = createModeledMethodKey(modeledMethod2);

      expect(key).not.toContain("output");
      expect(key).toEqual(key2);
    });

    it("for summary modeled methods", () => {
      const modeledMethod = createSummaryModeledMethod({
        input: "Argument[this]",
        output: "ReturnValue",
        ...{ supported: true },
      });
      const key = createModeledMethodKey(modeledMethod);

      const modeledMethod2 = createSummaryModeledMethod({
        input: "Argument[this]",
        output: "ReturnValue",
        ...{ supported: false },
      });
      const key2 = createModeledMethodKey(modeledMethod2);

      expect(key).not.toContain("supported");
      expect(key).toEqual(key2);
    });

    it("for neutral modeled methods", () => {
      const modeledMethod = createNeutralModeledMethod({
        type: "neutral",
        ...{
          input: "Argument[this]",
          output: "ReturnValue",
        },
      });
      const key = createModeledMethodKey(modeledMethod);

      const modeledMethod2 = createNeutralModeledMethod({
        type: "neutral",
        ...{
          input: "Argument[1]",
          output: "ReturnValue",
        },
      });
      const key2 = createModeledMethodKey(modeledMethod2);

      expect(key).not.toContain("input");
      expect(key).not.toContain("output");
      expect(key).toEqual(key2);
    });
  });
});
