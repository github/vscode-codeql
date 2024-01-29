import { Location } from "./locations/Location";
import { RawNumberValue } from "../common/RawNumberValue";
import type { CellValue } from "../../common/raw-result-types";
import { assertNever } from "../../common/helpers-pure";

interface Props {
  value: CellValue;
  databaseUri: string;
  onSelected?: () => void;
}

export default function RawTableValue({
  value,
  databaseUri,
  onSelected,
}: Props): React.JSX.Element {
  switch (value.type) {
    case "boolean":
      return <span>{value.value.toString()}</span>;
    case "number":
      return <RawNumberValue value={value.value} />;
    case "string":
      return <Location label={value.value} />;
    case "entity":
      return (
        <Location
          loc={value.value.url}
          label={value.value.label}
          databaseUri={databaseUri}
          onClick={onSelected}
        />
      );
    default:
      assertNever(value);
  }
}
