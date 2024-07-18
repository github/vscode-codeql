import type {
  Location as SarifLogLocation,
  ReportingDescriptorReference,
  ThreadFlowLocation,
  Run,
  PhysicalLocation,
  ArtifactLocation,
  ToolComponent,
} from "sarif";
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
import type { UserSettings } from "../../common/interface-types";

/** The definition of a taxon for a data extension model row. */
interface ModelTaxon {
  location: SarifLogLocation;
}

/** Resolve an `ArtifactLocation` that might contain a relative reference instead of an absolute
 * URI.
 */
function resolveArtifactLocation(
  location: ArtifactLocation,
  baseUri: URL,
): ArtifactLocation {
  if (location.uri === undefined) {
    // No URI at all. Just return the original location.
    return location;
  }
  return {
    ...location,
    uri: new URL(location.uri, baseUri).toString(),
  };
}

/** Get the URI of the pack's local root directory, if available. */
function getLocalPackUri(extension: ToolComponent): URL | undefined {
  if (extension.locations === undefined) {
    return undefined;
  }

  const localPackLocation = extension.locations.find(
    (loc) =>
      loc.properties !== undefined &&
      loc.properties.tags !== undefined &&
      loc.properties.tags.includes("CodeQL/LocalPackRoot"),
  );
  if (localPackLocation === undefined || localPackLocation.uri === undefined) {
    return undefined;
  }

  return new URL(localPackLocation.uri);
}

/** Resolve a `ReportingDescriptorReference` to the `ReportingDescriptor` for the taxon that it
 * refers to.
 */
function resolveTaxonDefinition(
  run: Run,
  taxonRef: ReportingDescriptorReference,
): ModelTaxon | undefined {
  const extensions = run.tool.extensions;
  if (extensions === undefined) {
    return undefined;
  }

  const extensionIndex = taxonRef.toolComponent?.index;
  if (
    extensionIndex === undefined ||
    extensionIndex < 0 ||
    extensionIndex >= extensions.length
  ) {
    return undefined;
  }

  const extension = extensions[extensionIndex];
  if (extension.taxa === undefined) {
    return undefined;
  }

  const localPackUri = getLocalPackUri(extension);
  if (localPackUri === undefined) {
    return undefined;
  }

  const taxonIndex = taxonRef.index;
  if (
    taxonIndex === undefined ||
    taxonIndex < 0 ||
    taxonIndex >= extension.taxa.length
  ) {
    return undefined;
  }

  const taxonDef = extension.taxa[taxonIndex];
  if (taxonDef.properties === undefined) {
    return undefined;
  }

  const location: PhysicalLocation =
    taxonDef.properties["CodeQL/DataExtensionLocation"];
  if (location === undefined || location.artifactLocation === undefined) {
    return undefined;
  }

  return {
    location: {
      physicalLocation: {
        ...location,
        artifactLocation: resolveArtifactLocation(
          location.artifactLocation,
          localPackUri,
        ),
      },
    },
  };
}

/** Generate the React elements for each taxon. */
function taxaLocations(
  taxa: ReportingDescriptorReference[] | undefined,
  run: Run | undefined,
  onClick: () => void,
) {
  if (taxa === undefined || taxa.length === 0 || run === undefined) {
    return [];
  }

  return taxa.flatMap((taxonRef, index) => {
    if (taxonRef.properties === undefined) {
      return [];
    }

    const role = taxonRef.properties["CodeQL/DataflowRole"];
    if (typeof role !== "string") {
      return [];
    }

    const taxonDef = resolveTaxonDefinition(run, taxonRef);
    if (taxonDef === undefined) {
      return [];
    }

    return (
      <div key={index}>
        {`(${role}) `}
        <SarifLocation
          loc={taxonDef.location}
          databaseUri={undefined}
          sourceLocationPrefix=""
          onClick={onClick}
        />
      </div>
    );
  });
}

interface Props {
  step: ThreadFlowLocation;
  pathNodeIndex: number;
  pathIndex: number;
  resultIndex: number;
  selectedItem: undefined | ResultKey;
  selectedItemRef: React.RefObject<HTMLTableRowElement>;
  databaseUri: string;
  sourceLocationPrefix: string;
  run?: Run;
  userSettings: UserSettings;
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
    run,
    userSettings,
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
      <td
        {...selectableZebraStripe(
          isSelected,
          zebraIndex,
          "vscode-codeql__taxa-cell",
        )}
      >
        {userSettings.shouldShowProvenance ? (
          <div className="vscode-codeql__taxa-cell-div">
            {taxaLocations(step.taxa, run, handleSarifLocationClicked)}
          </div>
        ) : (
          []
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
    </tr>
  );
}
