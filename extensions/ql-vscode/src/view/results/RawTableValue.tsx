import * as React from "react";

import { Location } from "./locations/Location";
import { CellValue } from "../../common/bqrs-cli-types";

interface Props {
  value: CellValue;
  databaseUri: string;
  onSelected?: () => void;
}

export default function RawTableValue(props: Props): JSX.Element {
  const rawValue = props.value;
  if (
    typeof rawValue === "string" ||
    typeof rawValue === "number" ||
    typeof rawValue === "boolean"
  ) {
    return <Location label={rawValue.toString()} />;
  }

  return (
    <Location
      loc={rawValue.url}
      label={rawValue.label}
      databaseUri={props.databaseUri}
      onClick={props.onSelected}
    />
  );
}
