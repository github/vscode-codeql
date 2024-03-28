import { createModeledMethodKey } from "../modeled-method";
import type { ModeledMethod, NeutralModeledMethod } from "../modeled-method";

export type ModeledMethodValidationError = {
  title: string;
  message: string;
  actionText: string;
  index: number;
};

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
    const key = createModeledMethodKey(modeledMethod);

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
