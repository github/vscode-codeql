import { ModeledMethod, NeutralModeledMethod } from "../modeled-method";
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
      };
    case "source":
      return {
        ...methodSignature,
        type: "source",
        output: modeledMethod.output,
        kind: modeledMethod.kind,
        provenance: "manual",
      };
    case "sink":
      return {
        ...methodSignature,
        type: "sink",
        input: modeledMethod.input,
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
        kind: modeledMethod.kind,
        provenance: "manual",
      };
    default:
      assertNever(modeledMethod);
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

  const neutralModeledMethods = consideredModeledMethods.filter(
    (modeledMethod): modeledMethod is NeutralModeledMethod =>
      modeledMethod.type === "neutral",
  );

  const neutralModeledMethodsByKind = new Map<string, ModeledMethod[]>();
  for (const neutralModeledMethod of neutralModeledMethods) {
    if (!neutralModeledMethodsByKind.has(neutralModeledMethod.kind)) {
      neutralModeledMethodsByKind.set(neutralModeledMethod.kind, []);
    }

    neutralModeledMethodsByKind
      .get(neutralModeledMethod.kind)
      ?.push(neutralModeledMethod);
  }

  for (const [
    neutralModeledMethodKind,
    neutralModeledMethods,
  ] of neutralModeledMethodsByKind) {
    const conflictingMethods = consideredModeledMethods.filter(
      (method) => neutralModeledMethodKind === method.type,
    );

    if (conflictingMethods.length < 1) {
      continue;
    }

    result.push({
      title: "Conflicting classification",
      message: `This method has a neutral ${neutralModeledMethodKind} classification, which conflicts with other ${neutralModeledMethodKind} classifications.`,
      actionText: "Modify or remove the neutral classification.",
      // Another validation will validate that only one neutral method is present, so we only need
      // to return an error for the first one
      index: modeledMethods.indexOf(neutralModeledMethods[0]),
    });
  }

  // Sort by index so that the errors are always in the same order
  result.sort((a, b) => a.index - b.index);

  return result;
}
