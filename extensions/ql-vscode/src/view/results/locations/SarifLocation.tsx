import type { Location as SarifLogLocation } from "sarif";
import { parseSarifLocation } from "../../../common/sarif-utils";
import { basename } from "../../../common/path";
import { useMemo } from "react";
import { Location } from "./Location";

interface Props {
  text?: string;
  loc?: SarifLogLocation;
  sourceLocationPrefix: string;
  databaseUri: string | undefined;
  onClick: () => void;
}

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
  onClick,
}: Props) {
  const parsedLoc = useMemo(
    () => loc && parseSarifLocation(loc, sourceLocationPrefix),
    [loc, sourceLocationPrefix],
  );
  if (parsedLoc === undefined || "hint" in parsedLoc) {
    return <Location label={text || "[no location]"} title={parsedLoc?.hint} />;
  }

  if (parsedLoc.type === "wholeFileLocation") {
    return (
      <Location
        loc={parsedLoc}
        label={text || `${basename(parsedLoc.userVisibleFile)}`}
        databaseUri={databaseUri}
        title={text ? undefined : `${parsedLoc.userVisibleFile}`}
        onClick={onClick}
      />
    );
  }

  if (parsedLoc.type === "lineColumnLocation") {
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
        onClick={onClick}
      />
    );
  }

  return null;
}
