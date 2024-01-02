interface Props {
  availableResultSets: string[];
  currentResultSetName: string;
  updateResultSet: (newResultSet: string) => void;
}

export default function CompareSelector(props: Props) {
  return props.availableResultSets.length ? (
    // Handle case where there are shared result sets
    <select
      value={props.currentResultSetName}
      onChange={(e) => props.updateResultSet(e.target.value)}
    >
      {props.availableResultSets.map((resultSet) => (
        <option key={resultSet} value={resultSet}>
          {resultSet}
        </option>
      ))}
    </select>
  ) : (
    // Handle case where there are no shared result sets
    <div>{props.currentResultSetName}</div>
  );
}
