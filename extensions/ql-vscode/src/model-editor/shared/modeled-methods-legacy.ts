import { ModeledMethod } from "../modeled-method";

/**
 * Converts a record of a single ModeledMethod indexed by signature to a record of ModeledMethod[] indexed by signature
 * for legacy usage. This function should always be used instead of the trivial conversion to track usages of this
 * conversion.
 *
 * This method should only be called inside a `postMessage` call. If it's used anywhere else, consider whether the
 * boundary is correct: the boundary should as close as possible to the extension host -> webview boundary.
 *
 * @param modeledMethods The record of a single ModeledMethod indexed by signature
 */
export function convertToLegacyModeledMethods(
  modeledMethods: Record<string, ModeledMethod[]>,
): Record<string, ModeledMethod> {
  // Always take the first modeled method in the array
  return Object.fromEntries(
    Object.entries(modeledMethods)
      .map(([signature, modeledMethods]) => {
        const modeledMethod = convertToLegacyModeledMethod(modeledMethods);
        if (!modeledMethod) {
          return null;
        }
        return [signature, modeledMethod];
      })
      .filter((entry): entry is [string, ModeledMethod] => entry !== null),
  );
}

/**
 * Converts a single ModeledMethod to a ModeledMethod[] for legacy usage. This function should always be used instead
 * of the trivial conversion to track usages of this conversion.
 *
 * This method should only be called inside a `onMessage` function (or its equivalent). If it's used anywhere else,
 * consider whether the boundary is correct: the boundary should as close as possible to the webview -> extension host
 * boundary.
 *
 * @param modeledMethod The single ModeledMethod
 */
export function convertFromLegacyModeledMethod(
  modeledMethod: ModeledMethod | undefined,
): ModeledMethod[] {
  return modeledMethod ? [modeledMethod] : [];
}

/**
 * Converts a ModeledMethod[] to a single ModeledMethod for legacy usage. This function should always be used instead
 * of the trivial conversion to track usages of this conversion.
 *
 * This method should only be called inside a `postMessage` call. If it's used anywhere else, consider whether the
 * boundary is correct: the boundary should as close as possible to the extension host -> webview boundary.
 *
 * @param modeledMethods The ModeledMethod[]
 */
export function convertToLegacyModeledMethod(
  modeledMethods: ModeledMethod[],
): ModeledMethod | undefined {
  return modeledMethods[0];
}
