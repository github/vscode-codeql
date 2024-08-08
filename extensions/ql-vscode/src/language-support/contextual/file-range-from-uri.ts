import { Location, Range } from "vscode";

import type {
  BqrsLineColumnLocation,
  BqrsUrlValue,
} from "../../common/bqrs-cli-types";
import { isEmptyPath } from "../../common/bqrs-utils";
import type { DatabaseItem } from "../../databases/local-databases";

export function fileRangeFromURI(
  uri: BqrsUrlValue | undefined,
  db: DatabaseItem,
): Location | undefined {
  if (!uri || typeof uri === "string") {
    return undefined;
  } else if ("startOffset" in uri) {
    return undefined;
  } else {
    const loc = uri as BqrsLineColumnLocation;
    if (isEmptyPath(loc.uri)) {
      return undefined;
    }
    const range = new Range(
      Math.max(0, (loc.startLine || 0) - 1),
      Math.max(0, (loc.startColumn || 0) - 1),
      Math.max(0, (loc.endLine || 0) - 1),
      Math.max(0, loc.endColumn || 0),
    );
    try {
      if (uri.uri.startsWith("file:")) {
        return new Location(db.resolveSourceFile(uri.uri), range);
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
}
