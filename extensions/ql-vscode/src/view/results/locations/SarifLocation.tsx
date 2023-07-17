import * as React from "react";
import * as Sarif from "sarif";
import { isLineColumnLoc, isWholeFileLoc } from "../../../common/bqrs-utils";
import { parseSarifLocation } from "../../../common/sarif-utils";
import { basename } from "path";
import { useMemo } from "react";
import { Location } from "./Location";

/**
 * A clickable SARIF location link.
 *
 * Custom text can be provided, but otherwise the text will be
 * a human-readable form of the location itself.
 */
export function SarifLocation({
  text,
  loc,
  sourceLocationPrefix,
  databaseUri,
  jumpToLocationCallback,
}: {
  text?: string;
  loc?: Sarif.Location;
  sourceLocationPrefix: string;
  databaseUri: string;
  jumpToLocationCallback: () => void;
}) {
  const parsedLoc = useMemo(
    () => loc && parseSarifLocation(loc, sourceLocationPrefix),
    [loc, sourceLocationPrefix],
  );
  if (parsedLoc === undefined || "hint" in parsedLoc) {
    return <Location label={text || "[no location]"} title={parsedLoc?.hint} />;
  } else if (isWholeFileLoc(parsedLoc)) {
    return (
      <Location
        loc={parsedLoc}
        label={text || `${basename(parsedLoc.userVisibleFile)}`}
        databaseUri={databaseUri}
        title={text ? undefined : `${parsedLoc.userVisibleFile}`}
        jumpToLocationCallback={jumpToLocationCallback}
      />
    );
  } else if (isLineColumnLoc(parsedLoc)) {
    return (
      <Location
        loc={parsedLoc}
        label={
          text ||
          `${basename(parsedLoc.userVisibleFile)}:${parsedLoc.startLine}:${
            parsedLoc.startColumn
          }`
        }
        databaseUri={databaseUri}
        title={text ? undefined : `${parsedLoc.userVisibleFile}`}
        jumpToLocationCallback={jumpToLocationCallback}
      />
    );
  } else {
    return null;
  }
}
