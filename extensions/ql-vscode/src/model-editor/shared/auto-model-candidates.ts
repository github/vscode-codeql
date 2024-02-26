import type { Method, MethodSignature } from "../method";
import type { ModeledMethod } from "../modeled-method";
import type { Mode } from "./mode";
import { groupMethods, sortGroupNames } from "./sorting";

/**
 * Return the candidates that the model should be run on. This includes limiting the number of
 * candidates to the candidate limit and filtering out anything that is already modeled and respecting
 * the order in the UI.
 * @param mode Whether it is application or framework mode.
 * @param methods all methods.
 * @param modeledMethodsBySignature the currently modeled methods.
 * @returns list of modeled methods that are candidates for modeling.
 */

export function getCandidates(
  mode: Mode,
  methods: readonly Method[],
  modeledMethodsBySignature: Record<string, readonly ModeledMethod[]>,
  processedByAutoModelMethods: Set<string>,
): MethodSignature[] {
  const candidateMethods = methods.filter((method) => {
    // Filter out any methods already processed by auto-model
    if (processedByAutoModelMethods.has(method.signature)) {
      return false;
    }

    const modeledMethods: ModeledMethod[] = [
      ...(modeledMethodsBySignature[method.signature] ?? []),
    ];

    // Anything that is modeled is not a candidate
    if (modeledMethods.some((m) => m.type !== "none")) {
      return false;
    }

    // A method that is supported is modeled outside of the model file, so it is not a candidate.
    if (method.supported) {
      return false;
    }

    return true;
  });

  // Sort the same way as the UI so we send the first ones listed in the UI first
  const grouped = groupMethods(candidateMethods, mode);
  return sortGroupNames(grouped).flatMap((name) => grouped[name]);
}
