import { validateModeledMethods } from "../../../../src/model-editor/shared/validation";
import { createModeledMethod } from "../../../factories/model-editor/modeled-method-factories";

describe(validateModeledMethods.name, () => {
  it("should not give an error with valid modeled methods", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "source",
        output: "ReturnValue",
      }),
      createModeledMethod({
        type: "sink",
        input: "Argument[this]",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toHaveLength(0);
  });

  it("should not give an error with valid modeled methods and an unmodeled method", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "source",
        output: "ReturnValue",
      }),
      createModeledMethod({
        type: "sink",
        input: "Argument[this]",
      }),
      createModeledMethod({
        type: "none",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toHaveLength(0);
  });

  it("should not give an error with valid modeled methods and multiple unmodeled methods", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "none",
      }),
      createModeledMethod({
        type: "source",
        output: "ReturnValue",
      }),
      createModeledMethod({
        type: "sink",
        input: "Argument[this]",
      }),
      createModeledMethod({
        type: "none",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toHaveLength(0);
  });

  it("should not give an error with a single neutral model", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "neutral",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toHaveLength(0);
  });

  it("should not give an error with a neutral model and an unmodeled method", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "neutral",
      }),
      createModeledMethod({
        type: "none",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toHaveLength(0);
  });

  it("should give an error with exact duplicate modeled methods", () => {
    const modeledMethods = [createModeledMethod(), createModeledMethod()];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([
      {
        index: 1,
        title: expect.stringMatching(/duplicate/i),
        message: expect.stringMatching(/identical/i),
        actionText: expect.stringMatching(/remove/i),
      },
    ]);
  });

  it("should give an error with duplicate modeled methods with different provenance", () => {
    const modeledMethods = [
      createModeledMethod({
        provenance: "df-generated",
      }),
      createModeledMethod({
        provenance: "manual",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([
      {
        index: 1,
        title: expect.stringMatching(/duplicate/i),
        message: expect.stringMatching(/identical/i),
        actionText: expect.stringMatching(/remove/i),
      },
    ]);
  });

  it("should give an error with duplicate modeled methods with different source unused fields", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "source",
        input: "Argument[this]",
        output: "ReturnValue",
      }),
      createModeledMethod({
        type: "source",
        input: "Argument[1]",
        output: "ReturnValue",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([
      {
        index: 1,
        title: expect.stringMatching(/duplicate/i),
        message: expect.stringMatching(/identical/i),
        actionText: expect.stringMatching(/remove/i),
      },
    ]);
  });

  it("should give an error with duplicate modeled methods with different sink unused fields", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "sink",
        input: "Argument[this]",
        output: "ReturnValue",
      }),
      createModeledMethod({
        type: "sink",
        input: "Argument[this]",
        output: "Argument[this]",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([
      {
        index: 1,
        title: expect.stringMatching(/duplicate/i),
        message: expect.stringMatching(/identical/i),
        actionText: expect.stringMatching(/remove/i),
      },
    ]);
  });

  it("should give an error with duplicate modeled methods with different summary unused fields", () => {
    const supportedTrue = {
      supported: true,
    };
    const supportedFalse = {
      supported: false,
    };

    const modeledMethods = [
      createModeledMethod({
        type: "sink",
        input: "Argument[this]",
        output: "ReturnValue",
        ...supportedTrue,
      }),
      createModeledMethod({
        type: "sink",
        input: "Argument[this]",
        output: "Argument[this]",
        ...supportedFalse,
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([
      {
        index: 1,
        title: expect.stringMatching(/duplicate/i),
        message: expect.stringMatching(/identical/i),
        actionText: expect.stringMatching(/remove/i),
      },
    ]);
  });

  it("should give an error with duplicate modeled methods with different neutral unused fields", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "neutral",
        input: "Argument[this]",
        output: "ReturnValue",
      }),
      createModeledMethod({
        type: "neutral",
        input: "Argument[1]",
        output: "Argument[this]",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([
      {
        index: 1,
        title: expect.stringMatching(/duplicate/i),
        message: expect.stringMatching(/identical/i),
        actionText: expect.stringMatching(/remove/i),
      },
    ]);
  });

  it("should give an error with neutral combined with other models", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "sink",
      }),
      createModeledMethod({
        type: "neutral",
        kind: "sink",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([
      {
        index: 1,
        title: expect.stringMatching(/conflicting/i),
        message: expect.stringMatching(/neutral/i),
        actionText: expect.stringMatching(/remove/i),
      },
    ]);
  });

  it("should not give an error with other neutral combined with other models", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "sink",
      }),
      createModeledMethod({
        type: "neutral",
        kind: "summary",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([]);
  });

  it("should give an error with duplicate neutral combined with other models", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "neutral",
        kind: "summary",
      }),
      createModeledMethod({
        type: "summary",
      }),
      createModeledMethod({
        type: "neutral",
        kind: "summary",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([
      {
        index: 0,
        title: expect.stringMatching(/conflicting/i),
        message: expect.stringMatching(/neutral/i),
        actionText: expect.stringMatching(/remove/i),
      },
      {
        index: 2,
        title: expect.stringMatching(/duplicate/i),
        message: expect.stringMatching(/identical/i),
        actionText: expect.stringMatching(/remove/i),
      },
    ]);
  });

  it("should include unmodeled methods in the index", () => {
    const modeledMethods = [
      createModeledMethod({
        type: "none",
      }),
      createModeledMethod({
        type: "neutral",
        kind: "sink",
      }),
      createModeledMethod({
        type: "sink",
      }),
      createModeledMethod({
        type: "neutral",
        kind: "sink",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([
      {
        index: 1,
        title: expect.stringMatching(/conflicting/i),
        message: expect.stringMatching(/neutral/i),
        actionText: expect.stringMatching(/remove/i),
      },
      {
        index: 3,
        title: expect.stringMatching(/duplicate/i),
        message: expect.stringMatching(/identical/i),
        actionText: expect.stringMatching(/remove/i),
      },
    ]);
  });
});
