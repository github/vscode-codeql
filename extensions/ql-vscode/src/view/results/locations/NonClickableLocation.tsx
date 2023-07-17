import * as React from "react";

/**
 * A non-clickable location for when there isn't a valid link.
 * Designed to fit in with the other types of location components.
 */
export function NonClickableLocation({
  msg,
  locationHint,
}: {
  msg?: string;
  locationHint?: string;
}) {
  if (msg === undefined) return null;
  return <span title={locationHint}>{msg}</span>;
}
