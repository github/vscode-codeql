import * as React from "react";
import { useMemo } from "react";

import { UrlValue } from "../../../common/bqrs-cli-types";
import {
  isStringLoc,
  tryGetResolvableLocation,
} from "../../../common/bqrs-utils";
import { convertNonPrintableChars } from "../../../common/text-utils";
import { NonClickableLocation } from "./NonClickableLocation";
import { ClickableLocation } from "./ClickableLocation";

interface Props {
  loc?: UrlValue;
  label?: string;
  databaseUri?: string;
  title?: string;
  onClick?: () => void;
}

/**
 * A location link. Will be clickable if a location URL and database URI are provided.
 */
export function Location({
  loc,
  label,
  databaseUri,
  title,
  onClick,
}: Props): JSX.Element {
  const resolvableLoc = useMemo(() => tryGetResolvableLocation(loc), [loc]);
  const displayLabel = useMemo(() => convertNonPrintableChars(label), [label]);

  if (loc === undefined) {
    return <NonClickableLocation msg={displayLabel} />;
  }

  if (isStringLoc(loc)) {
    return <a href={loc}>{loc}</a>;
  }

  if (databaseUri === undefined || resolvableLoc === undefined) {
    return <NonClickableLocation msg={displayLabel} locationHint={title} />;
  }

  return (
    <ClickableLocation
      loc={resolvableLoc}
      label={displayLabel}
      databaseUri={databaseUri}
      title={title}
      onClick={onClick}
    />
  );
}
