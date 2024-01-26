import { EmptyQueryResultsMessage } from "./EmptyQueryResultsMessage";
import TextButton from "../common/TextButton";

interface Props {
  nonemptyRawResults: boolean;
  showRawResults: () => void;
}

export function AlertTableNoResults(props: Props): React.JSX.Element {
  if (props.nonemptyRawResults) {
    return (
      <span>
        No Alerts. See{" "}
        <TextButton onClick={props.showRawResults}>raw results</TextButton>.
      </span>
    );
  } else {
    return <EmptyQueryResultsMessage />;
  }
}
