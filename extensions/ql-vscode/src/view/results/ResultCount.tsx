import type { ResultSet } from "../../common/interface-types";
import { tableHeaderItemClassName } from "./result-table-utils";

interface Props {
  resultSet?: ResultSet;
  filteredCount?: number;
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

  const totalCount = getResultCount(props.resultSet);
  if (props.filteredCount !== undefined) {
    return (
      <span className={tableHeaderItemClassName}>
        {props.filteredCount} / {totalCount}{" "}
        {totalCount === 1 ? "result" : "results"}
      </span>
    );
  }
  return (
    <span className={tableHeaderItemClassName}>
      {totalCount} {totalCount === 1 ? "result" : "results"}
    </span>
  );
}
