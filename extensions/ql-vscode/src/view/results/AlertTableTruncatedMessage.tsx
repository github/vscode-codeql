interface Props {
  numTruncatedResults: number;
}

export function AlertTableTruncatedMessage(
  props: Props,
): React.JSX.Element | null {
  if (props.numTruncatedResults === 0) {
    return null;
  }
  return (
    <tr key="truncatd-message">
      <td colSpan={5} style={{ textAlign: "center", fontStyle: "italic" }}>
        Too many results to show at once. {props.numTruncatedResults} result(s)
        omitted.
      </td>
    </tr>
  );
}
