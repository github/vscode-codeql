import type { ResultSet } from "../../common/interface-types";
import { tableHeaderItemClassName } from "./result-table-utils";

interface Props {
  resultSet?: ResultSet;
}

function getResultCount(resultSet: ResultSet): number {
  switch (resultSet.t) {
    case "RawResultSet":
      return resultSet.resultSet.totalRowCount;
    case "InterpretedResultSet":
      return resultSet.interpretation.numTotalResults;
  }
}

export function ResultCount(props: Props): React.JSX.Element | null {
  if (!props.resultSet) {
    return null;
  }

  const resultCount = getResultCount(props.resultSet);
  return (
    <span className={tableHeaderItemClassName}>
      {resultCount} {resultCount === 1 ? "result" : "results"}
    </span>
  );
}
