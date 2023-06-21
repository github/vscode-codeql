import * as vscode from "vscode";

import { UrlValue, LineColumnLocation } from "../../common/bqrs-cli-types";
import { isEmptyPath } from "../../pure/bqrs-utils";
import { DatabaseItem } from "../../databases/local-databases";

export function fileRangeFromURI(
  uri: UrlValue | undefined,
  db: DatabaseItem,
): vscode.Location | undefined {
  if (!uri || typeof uri === "string") {
    return undefined;
  } else if ("startOffset" in uri) {
    return undefined;
  } else {
    const loc = uri as LineColumnLocation;
    if (isEmptyPath(loc.uri)) {
      return undefined;
    }
    const range = new vscode.Range(
      Math.max(0, (loc.startLine || 0) - 1),
      Math.max(0, (loc.startColumn || 0) - 1),
      Math.max(0, (loc.endLine || 0) - 1),
      Math.max(0, loc.endColumn || 0),
    );
    try {
      if (uri.uri.startsWith("file:")) {
        return new vscode.Location(db.resolveSourceFile(uri.uri), range);
      }
      return undefined;
    } catch (e) {
      return undefined;
    }
  }
}
