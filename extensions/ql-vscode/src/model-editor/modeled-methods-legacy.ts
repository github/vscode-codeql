import { ModeledMethod } from "./modeled-method";

export function convertFromLegacyModeledMethods(
  modeledMethods: Record<string, ModeledMethod>,
): Record<string, ModeledMethod[]> {
  // Convert a single ModeledMethod to an array of ModeledMethods
  return Object.fromEntries(
    Object.entries(modeledMethods).map(([signature, modeledMethod]) => {
      return [signature, [modeledMethod]];
    }),
  );
}

export function convertToLegacyModeledMethods(
  modeledMethods: Record<string, ModeledMethod[]>,
): Record<string, ModeledMethod> {
  // Always take the first modeled method in the array
  return Object.fromEntries(
    Object.entries(modeledMethods).map(([signature, modeledMethods]) => {
      return [signature, modeledMethods[0]];
    }),
  );
}
