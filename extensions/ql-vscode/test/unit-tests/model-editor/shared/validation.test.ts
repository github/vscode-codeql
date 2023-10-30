import { validateModeledMethods } from "../../../../src/model-editor/shared/validation";
import {
  createNeutralModeledMethod,
  createNoneModeledMethod,
  createSinkModeledMethod,
  createSourceModeledMethod,
  createSummaryModeledMethod,
} from "../../../factories/model-editor/modeled-method-factories";

describe(validateModeledMethods.name, () => {
  it("should not give an error with valid modeled methods", () => {
    const modeledMethods = [
      createSourceModeledMethod({
        output: "ReturnValue",
      }),
      createSinkModeledMethod({
        input: "Argument[this]",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toHaveLength(0);
  });

  it("should not give an error with valid modeled methods and an unmodeled method", () => {
    const modeledMethods = [
      createSourceModeledMethod({
        output: "ReturnValue",
      }),
      createSinkModeledMethod({
        input: "Argument[this]",
      }),
      createNoneModeledMethod(),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toHaveLength(0);
  });

  it("should not give an error with valid modeled methods and multiple unmodeled methods", () => {
    const modeledMethods = [
      createNoneModeledMethod(),
      createSourceModeledMethod({
        output: "ReturnValue",
      }),
      createSinkModeledMethod({
        input: "Argument[this]",
      }),
      createNoneModeledMethod(),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toHaveLength(0);
  });

  it("should not give an error with a single neutral model", () => {
    const modeledMethods = [createNeutralModeledMethod()];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toHaveLength(0);
  });

  it("should not give an error with a neutral model and an unmodeled method", () => {
    const modeledMethods = [
      createNeutralModeledMethod(),
      createNoneModeledMethod(),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toHaveLength(0);
  });

  it("should give an error with exact duplicate modeled methods", () => {
    const modeledMethods = [
      createSinkModeledMethod(),
      createSinkModeledMethod(),
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

  it("should give an error with duplicate modeled methods with different provenance", () => {
    const modeledMethods = [
      createSinkModeledMethod({
        provenance: "df-generated",
      }),
      createSinkModeledMethod({
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
    const modeledMethod1 = createSourceModeledMethod({
      output: "ReturnValue",
      ...{
        input: "Argument[this]",
      },
    });

    const modeledMethod2 = createSourceModeledMethod({
      output: "ReturnValue",
      ...{
        input: "Argument[1]",
      },
    });

    const modeledMethods = [modeledMethod1, modeledMethod2];

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
    const modeledMethod1 = createSinkModeledMethod({
      type: "sink",
      input: "Argument[this]",
      ...{
        output: "ReturnValue",
      },
    });
    const modeledMethod2 = createSinkModeledMethod({
      type: "sink",
      input: "Argument[this]",
      ...{
        output: "Argument[this]",
      },
    });

    const modeledMethods = [modeledMethod1, modeledMethod2];

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
      createSummaryModeledMethod({
        input: "Argument[this]",
        output: "ReturnValue",
        ...supportedTrue,
      }),
      createSummaryModeledMethod({
        input: "Argument[this]",
        output: "ReturnValue",
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
      createNeutralModeledMethod({
        type: "neutral",
        ...{
          input: "Argument[this]",
          output: "ReturnValue",
        },
      }),
      createNeutralModeledMethod({
        type: "neutral",
        ...{
          input: "Argument[1]",
          output: "Argument[this]",
        },
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
      createSinkModeledMethod(),
      createNeutralModeledMethod({
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
      createSinkModeledMethod(),
      createNeutralModeledMethod({
        kind: "summary",
      }),
    ];

    const errors = validateModeledMethods(modeledMethods);

    expect(errors).toEqual([]);
  });

  it("should give an error with duplicate neutral combined with other models", () => {
    const modeledMethods = [
      createNeutralModeledMethod({
        kind: "summary",
      }),
      createSummaryModeledMethod(),
      createNeutralModeledMethod({
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
      createNoneModeledMethod(),
      createNeutralModeledMethod({
        kind: "sink",
      }),
      createSinkModeledMethod(),
      createNeutralModeledMethod({
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
