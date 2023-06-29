import { ExternalApiUsage } from "../external-api-usage";
import { Mode } from "./mode";
import { calculateModeledPercentage } from "./modeled-percentage";

export function groupMethods(
  externalApiUsages: ExternalApiUsage[],
  mode: Mode,
): Record<string, ExternalApiUsage[]> {
  const groupedByLibrary: Record<string, ExternalApiUsage[]> = {};

  for (const externalApiUsage of externalApiUsages) {
    // Group by package if using framework mode
    const key =
      mode === Mode.Framework
        ? externalApiUsage.packageName
        : externalApiUsage.library;

    groupedByLibrary[key] ??= [];
    groupedByLibrary[key].push(externalApiUsage);
  }

  return groupedByLibrary;
}

export function sortGroupNames(
  methods: Record<string, ExternalApiUsage[]>,
): string[] {
  return Object.keys(methods).sort((a, b) =>
    compareGroups(methods[a], a, methods[b], b),
  );
}

export function sortMethods(
  externalApiUsages: ExternalApiUsage[],
): ExternalApiUsage[] {
  const sortedExternalApiUsages = [...externalApiUsages];
  sortedExternalApiUsages.sort((a, b) => compareMethod(a, b));
  return sortedExternalApiUsages;
}

function compareGroups(
  a: ExternalApiUsage[],
  aName: string,
  b: ExternalApiUsage[],
  bName: string,
): number {
  const supportedPercentageA = calculateModeledPercentage(a);
  const supportedPercentageB = calculateModeledPercentage(b);

  // Sort first by supported percentage ascending
  if (supportedPercentageA > supportedPercentageB) {
    return 1;
  }
  if (supportedPercentageA < supportedPercentageB) {
    return -1;
  }

  const numberOfUsagesA = a.reduce((acc, curr) => acc + curr.usages.length, 0);
  const numberOfUsagesB = b.reduce((acc, curr) => acc + curr.usages.length, 0);

  // If the number of usages is equal, sort by number of methods descending
  if (numberOfUsagesA === numberOfUsagesB) {
    const numberOfMethodsA = a.length;
    const numberOfMethodsB = b.length;

    // If the number of methods is equal, sort by library name ascending
    if (numberOfMethodsA === numberOfMethodsB) {
      return aName.localeCompare(bName);
    }

    return numberOfMethodsB - numberOfMethodsA;
  }

  // Then sort by number of usages descending
  return numberOfUsagesB - numberOfUsagesA;
}

function compareMethod(a: ExternalApiUsage, b: ExternalApiUsage): number {
  // Sort first by supported, putting unmodeled methods first.
  if (a.supported && !b.supported) {
    return 1;
  }
  if (!a.supported && b.supported) {
    return -1;
  }
  // Then sort by number of usages descending
  return b.usages.length - a.usages.length;
}
