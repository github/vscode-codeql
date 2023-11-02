import { createNoneModeledMethod } from "../../factories/model-editor/modeled-method-factories";
import {
  ModeledMethod,
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
