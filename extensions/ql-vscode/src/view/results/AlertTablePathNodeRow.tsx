import type { ThreadFlowLocation } from "sarif";
import type {
  PathNode,
  Result as ResultKeysResult,
  ResultKey,
} from "./result-keys";
import { equalsNotUndefined } from "./result-keys";
import { SarifLocation } from "./locations/SarifLocation";
import { selectableZebraStripe } from "./result-table-utils";
import { useCallback, useMemo } from "react";
import { VerticalRule } from "../common/VerticalRule";

interface Props {
  step: ThreadFlowLocation;
  pathNodeIndex: number;
  pathIndex: number;
  resultIndex: number;
  selectedItem: undefined | ResultKey;
  selectedItemRef: React.RefObject<HTMLTableRowElement>;
  databaseUri: string;
  sourceLocationPrefix: string;
  updateSelectionCallback: (
    resultKey: PathNode | ResultKeysResult | undefined,
  ) => void;
}

export function AlertTablePathNodeRow(props: Props) {
  const {
    step,
    pathNodeIndex,
    pathIndex,
    resultIndex,
    selectedItem,
    selectedItemRef,
    databaseUri,
    sourceLocationPrefix,
    updateSelectionCallback,
  } = props;

  const pathNodeKey: PathNode = useMemo(
    () => ({
      resultIndex,
      pathIndex,
      pathNodeIndex,
    }),
    [pathIndex, pathNodeIndex, resultIndex],
  );
  const handleSarifLocationClicked = useCallback(
    () => updateSelectionCallback(pathNodeKey),
    [pathNodeKey, updateSelectionCallback],
  );

  const isSelected = equalsNotUndefined(selectedItem, pathNodeKey);
  const stepIndex = pathNodeIndex + 1; // Convert to 1-based
  const zebraIndex = resultIndex + stepIndex;
  return (
    <tr
      ref={isSelected ? selectedItemRef : undefined}
      className={isSelected ? "vscode-codeql__selected-path-node" : undefined}
    >
      <td className="vscode-codeql__icon-cell">
        <VerticalRule />
      </td>
      <td className="vscode-codeql__icon-cell">
        <VerticalRule />
      </td>
      <td
        {...selectableZebraStripe(
          isSelected,
          zebraIndex,
          "vscode-codeql__path-index-cell",
        )}
      >
        {stepIndex}
      </td>
      <td {...selectableZebraStripe(isSelected, zebraIndex)}>
        {step.location && step.location.message ? (
          <SarifLocation
            text={step.location.message.text}
            loc={step.location}
            sourceLocationPrefix={sourceLocationPrefix}
            databaseUri={databaseUri}
            onClick={handleSarifLocationClicked}
          />
        ) : (
          "[no location]"
        )}
      </td>
      <td {...selectableZebraStripe(isSelected, zebraIndex)}>{"model"}</td>
      <td
        {...selectableZebraStripe(
          isSelected,
          zebraIndex,
          "vscode-codeql__location-cell",
        )}
      >
        {step.location && (
          <SarifLocation
            loc={step.location}
            sourceLocationPrefix={sourceLocationPrefix}
            databaseUri={databaseUri}
            onClick={handleSarifLocationClicked}
          />
        )}
      </td>
    </tr>
  );
}
