import type {
  Location as SarifLogLocation,
  ArtifactLocation,
  PhysicalLocation,
  ReportingDescriptorReference,
  Run,
  ToolComponent,
} from "sarif";
import { SarifLocation } from "./SarifLocation";

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

interface Props {
  taxa: ReportingDescriptorReference[] | undefined;
  run: Run | undefined;
  onClick: () => void;
}

/** Generate the React elements for each taxon. */
export function TaxaLocations({
  taxa,
  run,
  onClick,
}: Props): React.JSX.Element[] {
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
