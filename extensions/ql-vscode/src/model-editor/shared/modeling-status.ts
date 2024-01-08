import type { ModeledMethod } from "../modeled-method";

export type ModelingStatus = "unmodeled" | "unsaved" | "saved";

export function getModelingStatus(
  modeledMethods: readonly ModeledMethod[],
  methodIsUnsaved: boolean,
): ModelingStatus {
  if (modeledMethods.length > 0) {
    if (methodIsUnsaved) {
      return "unsaved";
    } else if (modeledMethods.some((m) => m.type !== "none")) {
      return "saved";
    }
  }
  return "unmodeled";
}
