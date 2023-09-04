import { Method } from "../method";
import { Mode } from "./mode";
import { calculateModeledPercentage } from "./modeled-percentage";

export function groupMethods(
  methods: Method[],
  mode: Mode,
): Record<string, Method[]> {
  const groupedByLibrary: Record<string, Method[]> = {};

  for (const method of methods) {
    // Group by package if using framework mode
    const key = mode === Mode.Framework ? method.packageName : method.library;

    groupedByLibrary[key] ??= [];
    groupedByLibrary[key].push(method);
  }

  return groupedByLibrary;
}

export function sortGroupNames(methods: Record<string, Method[]>): string[] {
  return Object.keys(methods).sort((a, b) =>
    compareGroups(methods[a], a, methods[b], b),
  );
}

export function sortMethods(methods: Method[]): Method[] {
  const sortedMethods = [...methods];
  sortedMethods.sort((a, b) => compareMethod(a, b));
  return sortedMethods;
}

function compareGroups(
  a: Method[],
  aName: string,
  b: Method[],
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

function compareMethod(a: Method, b: Method): number {
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
