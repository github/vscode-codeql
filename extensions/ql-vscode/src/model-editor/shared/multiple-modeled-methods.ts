import type { ModeledMethod } from "../modeled-method";

export function canAddNewModeledMethod(
  modeledMethods: ModeledMethod[],
): boolean {
  // Disallow adding methods when there are no modeled methods or where there is a single unmodeled method.
  // In both of these cases the UI will already be showing the user inputs they can use for modeling.
  return (
    modeledMethods.length > 1 ||
    (modeledMethods.length === 1 && modeledMethods[0].type !== "none")
  );
}

export function canRemoveModeledMethod(
  modeledMethods: ModeledMethod[],
): boolean {
  // Don't allow removing the last modeled method. In this case the user is intended to
  // set the type to "none" instead.
  return modeledMethods.length > 1;
}
