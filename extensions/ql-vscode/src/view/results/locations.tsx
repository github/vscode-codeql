import * as React from "react";
import * as Sarif from "sarif";
import { ResolvableLocationValue, UrlValue } from "../../common/bqrs-cli-types";
import { convertNonPrintableChars } from "../../common/text-utils";
import {
  isLineColumnLoc,
  isStringLoc,
  isWholeFileLoc,
  tryGetResolvableLocation,
} from "../../common/bqrs-utils";
import {
  parseSarifLocation,
  parseSarifPlainTextMessage,
} from "../../common/sarif-utils";
import { basename } from "path";
import { jumpToLocation } from "./result-table-utils";
import { useCallback, useMemo } from "react";

function NonLocation({
  msg,
  locationHint,
}: {
  msg?: string;
  locationHint?: string;
}) {
  if (msg === undefined) return null;
  return <span title={locationHint}>{msg}</span>;
}

function ClickableLocation({
  loc,
  label,
  databaseUri,
  title,
  jumpToLocationCallback,
}: {
  loc: ResolvableLocationValue;
  label: string;
  databaseUri: string;
  title?: string;
  jumpToLocationCallback?: () => void;
}): JSX.Element {
  const jumpToLocationHandler = useCallback(
    (e: React.MouseEvent) => {
      jumpToLocation(loc, databaseUri);
      e.preventDefault();
      e.stopPropagation();
      if (jumpToLocationCallback) {
        jumpToLocationCallback();
      }
    },
    [loc, databaseUri, jumpToLocationCallback],
  );

  return (
    <>
      {/*
          eslint-disable-next-line
          jsx-a11y/anchor-is-valid,
        */}
      <a
        href="#"
        className="vscode-codeql__result-table-location-link"
        title={title}
        onClick={jumpToLocationHandler}
      >
        {label}
      </a>
    </>
  );
}

/**
 * A clickable location link.
 */
export function Location({
  loc,
  label,
  databaseUri,
  title,
  jumpToLocationCallback,
}: {
  loc?: UrlValue;
  label?: string;
  databaseUri?: string;
  title?: string;
  jumpToLocationCallback?: () => void;
}): JSX.Element {
  const resolvableLoc = useMemo(() => tryGetResolvableLocation(loc), [loc]);
  const displayLabel = useMemo(() => convertNonPrintableChars(label!), [label]);
  if (loc === undefined) {
    return <NonLocation msg={displayLabel} />;
  } else if (isStringLoc(loc)) {
    return <a href={loc}>{loc}</a>;
  } else if (databaseUri === undefined || resolvableLoc === undefined) {
    return <NonLocation msg={displayLabel} locationHint={title} />;
  } else {
    return (
      <ClickableLocation
        loc={resolvableLoc}
        label={displayLabel}
        databaseUri={databaseUri}
        title={title}
        jumpToLocationCallback={jumpToLocationCallback}
      />
    );
  }
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
    return (
      <NonLocation
        msg={text || "[no location]"}
        locationHint={parsedLoc?.hint}
      />
    );
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

/**
 * Parses a SARIF message and populates clickable locations.
 */
export function SarifMessageWithLocations({
  msg,
  relatedLocations,
  sourceLocationPrefix,
  databaseUri,
  jumpToLocationCallback,
}: {
  msg: string;
  relatedLocations: Sarif.Location[];
  sourceLocationPrefix: string;
  databaseUri: string;
  jumpToLocationCallback: () => void;
}) {
  const relatedLocationsById: Map<number, Sarif.Location> = new Map();
  for (const loc of relatedLocations) {
    if (loc.id !== undefined) {
      relatedLocationsById.set(loc.id, loc);
    }
  }

  return (
    <>
      {parseSarifPlainTextMessage(msg).map((part, i) => {
        if (typeof part === "string") {
          return <span key={i}>{part}</span>;
        } else {
          return (
            <SarifLocation
              key={i}
              text={part.text}
              loc={relatedLocationsById.get(part.dest)}
              sourceLocationPrefix={sourceLocationPrefix}
              databaseUri={databaseUri}
              jumpToLocationCallback={jumpToLocationCallback}
            />
          );
        }
      })}
    </>
  );
}
