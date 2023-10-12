import { ModeledMethod } from "../modeled-method";
import { MethodSignature } from "../method";
import { assertNever } from "../../common/helpers-pure";

export type ModeledMethodValidationError = {
  title: string;
  message: string;
  actionText: string;
  index: number;
};

/**
 * This method will reset any properties which are not used for the specific type of modeled method.
 *
 * It will also set the `provenance` to `manual` since multiple modelings of the same method with a
 * different provenance are not actually different.
 *
 * The returned canonical modeled method should only be used for comparisons. It should not be used
 * for display purposes, saving the model, or any other purpose which requires the original modeled
 * method to be preserved.
 *
 * @param modeledMethod The modeled method to canonicalize
 */
function canonicalizeModeledMethod(
  modeledMethod: ModeledMethod,
): ModeledMethod {
  const methodSignature: MethodSignature = {
    signature: modeledMethod.signature,
    packageName: modeledMethod.packageName,
    typeName: modeledMethod.typeName,
    methodName: modeledMethod.methodName,
    methodParameters: modeledMethod.methodParameters,
  };

  switch (modeledMethod.type) {
    case "none":
      return {
        ...methodSignature,
        type: "none",
        input: "",
        output: "",
        kind: "",
        provenance: "manual",
      };
    case "source":
      return {
        ...methodSignature,
        type: "source",
        input: "",
        output: modeledMethod.output,
        kind: modeledMethod.kind,
        provenance: "manual",
      };
    case "sink":
      return {
        ...methodSignature,
        type: "sink",
        input: modeledMethod.input,
        output: "",
        kind: modeledMethod.kind,
        provenance: "manual",
      };
    case "summary":
      return {
        ...methodSignature,
        type: "summary",
        input: modeledMethod.input,
        output: modeledMethod.output,
        kind: modeledMethod.kind,
        provenance: "manual",
      };
    case "neutral":
      return {
        ...methodSignature,
        type: "neutral",
        input: "",
        output: "",
        kind: "",
        provenance: "manual",
      };
    default:
      assertNever(modeledMethod.type);
  }
}

export function validateModeledMethods(
  modeledMethods: ModeledMethod[],
): ModeledMethodValidationError[] {
  // Anything that is not modeled will not be saved, so we don't need to validate it
  const consideredModeledMethods = modeledMethods.filter(
    (modeledMethod) => modeledMethod.type !== "none",
  );

  const result: ModeledMethodValidationError[] = [];

  // If the same model is present multiple times, only the first one makes sense, so we should give
  // an error for any duplicates.
  const seenModeledMethods = new Set<string>();
  for (const modeledMethod of consideredModeledMethods) {
    const canonicalModeledMethod = canonicalizeModeledMethod(modeledMethod);
    const key = JSON.stringify(
      canonicalModeledMethod,
      // This ensures the keys are always in the same order
      Object.keys(canonicalModeledMethod).sort(),
    );

    if (seenModeledMethods.has(key)) {
      result.push({
        title: "Duplicated classification",
        message:
          "This method has two identical or conflicting classifications.",
        actionText: "Modify or remove the duplicated classification.",
        index: modeledMethods.indexOf(modeledMethod),
      });
    } else {
      seenModeledMethods.add(key);
    }
  }

  const neutralModeledMethod = consideredModeledMethods.find(
    (modeledMethod) => modeledMethod.type === "neutral",
  );
  const hasNonNeutralModeledMethod = consideredModeledMethods.some(
    (modeledMethod) => modeledMethod.type !== "neutral",
  );

  // If there is a neutral model and any other model, that is an error
  if (neutralModeledMethod && hasNonNeutralModeledMethod) {
    // Another validation will validate that only one neutral method is present, so we only need
    // to return an error for the first one

    result.push({
      title: "Conflicting classification",
      message:
        "This method has a neutral classification, which conflicts with other classifications.",
      actionText: "Modify or remove the neutral classification.",
      index: modeledMethods.indexOf(neutralModeledMethod),
    });
  }

  // Sort by index so that the errors are always in the same order
  result.sort((a, b) => a.index - b.index);

  return result;
}
