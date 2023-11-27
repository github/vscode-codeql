import * as React from "react";
import { useMemo } from "react";

import { UrlValue } from "../../../common/raw-result-types";
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
  const displayLabel = useMemo(() => convertNonPrintableChars(label), [label]);

  if (loc === undefined) {
    return <NonClickableLocation msg={displayLabel} />;
  }

  if (loc.type === "string") {
    return <a href={loc.value}>{loc.value}</a>;
  }

  if (databaseUri === undefined) {
    return <NonClickableLocation msg={displayLabel} locationHint={title} />;
  }

  return (
    <ClickableLocation
      loc={loc}
      label={displayLabel}
      databaseUri={databaseUri}
      onClick={onClick}
    />
  );
}
