import * as React from "react";

import { Location } from "./locations/Location";
import { CellValue } from "../../common/bqrs-cli-types";
import { RawNumberValue } from "../common/RawNumberValue";

interface Props {
  value: CellValue;
  databaseUri: string;
  onSelected?: () => void;
}

export default function RawTableValue({
  value,
  databaseUri,
  onSelected,
}: Props): JSX.Element {
  switch (typeof value) {
    case "boolean":
      return <span>{value.toString()}</span>;
    case "number":
      return <RawNumberValue value={value} />;
    case "string":
      return <Location label={value.toString()} />;
    default:
      return (
        <Location
          loc={value.url}
          label={value.label}
          databaseUri={databaseUri}
          onClick={onSelected}
        />
      );
  }
}
