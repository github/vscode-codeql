import type { Location as SarifLogLocation } from "sarif";
import { parseSarifPlainTextMessage } from "../../../common/sarif-utils";
import { SarifLocation } from "./SarifLocation";

interface Props {
  msg: string;
  relatedLocations: SarifLogLocation[];
  sourceLocationPrefix: string;
  databaseUri: string;
  onClick: () => void;
}

/**
 * Parses a SARIF message and populates clickable locations.
 */
export function SarifMessageWithLocations({
  msg,
  relatedLocations,
  sourceLocationPrefix,
  databaseUri,
  onClick,
}: Props) {
  const relatedLocationsById: Map<number, SarifLogLocation> = new Map();
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
              onClick={onClick}
            />
          );
        }
      })}
    </>
  );
}
