import * as React from "react";
import { useCallback, useRef, useState } from "react";
import * as sarif from "sarif";
import { AlertTableResultRow } from "../results/AlertTableResultRow";
import * as Keys from "../results/result-keys";
import { useScrollIntoView } from "../results/useScrollIntoView";
import { sendTelemetry } from "../common/telemetry";

type Props = {
  results: sarif.Result[];
  databaseUri: string;
  sourceLocationPrefix: string;

  className?: string;
};

export const InterpretedCompareResultTable = ({
  results,
  databaseUri,
  sourceLocationPrefix,
  className,
}: Props) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set<string>());
  const [selectedItem, setSelectedItem] = useState<Keys.ResultKey | undefined>(
    undefined,
  );

  const selectedItemRef = useRef<any>();
  useScrollIntoView(selectedItem, selectedItemRef);

  /**
   * Given a list of `keys`, toggle the first, and if we 'open' the
   * first item, open all the rest as well. This mimics vscode's file
   * explorer tree view behavior.
   */
  const toggle = useCallback((e: React.MouseEvent, keys: Keys.ResultKey[]) => {
    const keyStrings = keys.map(Keys.keyToString);
    setExpanded((previousExpanded) => {
      const expanded = new Set(previousExpanded);
      if (previousExpanded.has(keyStrings[0])) {
        expanded.delete(keyStrings[0]);
      } else {
        for (const str of keyStrings) {
          expanded.add(str);
        }
      }
      if (expanded) {
        sendTelemetry("local-results-alert-table-path-expanded");
      }
      return expanded;
    });
    e.stopPropagation();
    e.preventDefault();
  }, []);

  const updateSelectionCallback = useCallback(
    (resultKey: Keys.PathNode | Keys.Result | undefined) => {
      setSelectedItem(resultKey);
      sendTelemetry("local-results-alert-table-path-selected");
    },
    [],
  );

  return (
    <table className={className}>
      <thead>
        <tr>
          <th colSpan={2}></th>
          <th className={`vscode-codeql__alert-message-cell`} colSpan={3}>
            Message
          </th>
        </tr>
      </thead>
      <tbody>
        {results.map((result, resultIndex) => (
          <AlertTableResultRow
            key={resultIndex}
            result={result}
            resultIndex={resultIndex}
            expanded={expanded}
            selectedItem={selectedItem}
            selectedItemRef={selectedItemRef}
            databaseUri={databaseUri}
            sourceLocationPrefix={sourceLocationPrefix}
            updateSelectionCallback={updateSelectionCallback}
            toggleExpanded={toggle}
          />
        ))}
      </tbody>
    </table>
  );
};
