import { ModeledMethod } from "../modeled-method";

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
