import { ModeledMethod } from "../modeled-method";

export type ModelingStatus = "unmodeled" | "unsaved" | "saved";

export function getModelingStatus(
  modeledMethod: ModeledMethod | undefined,
  methodIsUnsaved: boolean,
): ModelingStatus {
  if (modeledMethod) {
    if (methodIsUnsaved) {
      return "unsaved";
    } else if (modeledMethod.type !== "none") {
      return "saved";
    }
  }
  return "unmodeled";
}

export function getModelingStatusForModeledMethods(
  modeledMethods: ModeledMethod[],
  methodIsUnsaved: boolean,
): ModelingStatus {
  if (modeledMethods.length === 0) {
    return "unmodeled";
  }

  if (methodIsUnsaved) {
    return "unsaved";
  }

  for (const modeledMethod of modeledMethods) {
    if (modeledMethod.type !== "none") {
      return "saved";
    }
  }

  return "unmodeled";
}
