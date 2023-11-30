import * as React from "react";
import * as Sarif from "sarif";
import * as Keys from "./result-keys";
import { SarifLocation } from "./locations/SarifLocation";
import { selectableZebraStripe } from "./result-table-utils";
import { useCallback, useMemo } from "react";
import { MadFileLocation } from "../../common/interface-types";
import { AlertTableMadLink } from "./AlertTableMadLink";

interface Props {
  step: Sarif.ThreadFlowLocation;
  pathNodeIndex: number;
  pathIndex: number;
  resultIndex: number;
  selectedItem: undefined | Keys.ResultKey;
  selectedItemRef: React.RefObject<any>;
  databaseUri: string;
  sourceLocationPrefix: string;
  updateSelectionCallback: (
    resultKey: Keys.PathNode | Keys.Result | undefined,
  ) => void;
  madData: Record<string, MadFileLocation[]>;
  secondStep: Sarif.ThreadFlowLocation | undefined;
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
    madData,
    secondStep,
  } = props;

  const pathNodeKey: Keys.PathNode = useMemo(
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

  const isSelected = Keys.equalsNotUndefined(selectedItem, pathNodeKey);
  const stepIndex = pathNodeIndex + 1; // Convert to 1-based
  const zebraIndex = resultIndex + stepIndex;

  const madLocations = findLocations(step, madData);
  const modifiedMadLocations = filterLocations(
    madLocations,
    stepIndex,
    secondStep,
    madData,
  );

  return (
    <tr
      ref={isSelected ? selectedItemRef : undefined}
      className={isSelected ? "vscode-codeql__selected-path-node" : undefined}
    >
      <td className="vscode-codeql__icon-cell">
        <span className="vscode-codeql__vertical-rule"></span>
      </td>
      <td className="vscode-codeql__icon-cell">
        <span className="vscode-codeql__vertical-rule"></span>
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
      <td {...selectableZebraStripe(isSelected, zebraIndex)}>
        {modifiedMadLocations.map((madLocation, i) => (
          <AlertTableMadLink key={i} madLocation={madLocation} />
        ))}
      </td>
    </tr>
  );
}

function findLocations(
  flow: Sarif.ThreadFlowLocation,
  madData: Record<string, MadFileLocation[]>,
): MadFileLocation[] {
  const madHash = flow.properties && flow.properties["mad.hash"];
  if (!madHash) {
    return [];
  }
  const locations: MadFileLocation[] = [];

  for (const value of madHash.split(",")) {
    if (!value) {
      continue;
    }
    const madLocations = madData[value];
    if (madLocations) {
      locations.push(...madLocations);
    }
  }

  return locations;
}

function filterLocations(
  locations: MadFileLocation[],
  stepIndex: number,
  secondStep: Sarif.ThreadFlowLocation | undefined,
  madData: Record<string, MadFileLocation[]>,
): MadFileLocation[] {
  const results: MadFileLocation[] = [];

  for (const loc of locations) {
    if (loc.extensible === "sourceModel") {
      continue;
    }
    results.push(loc);
  }

  if (stepIndex === 1 && secondStep) {
    const secondLocations = findLocations(secondStep, madData);
    for (const loc of secondLocations) {
      if (loc.extensible !== "sourceModel") {
        continue;
      }
      results.push(loc);
    }
  }

  return results;
}
