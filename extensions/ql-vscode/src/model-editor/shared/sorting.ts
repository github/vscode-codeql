import { canMethodBeModeled } from "../method";
import type { Method } from "../method";
import type { ModeledMethod } from "../modeled-method";
import { Mode } from "./mode";
import { calculateModeledPercentage } from "./modeled-percentage";

/**
 * Groups methods by library or package name.
 * Does not change the order of methods within a group.
 */
export function groupMethods(
  methods: readonly Method[],
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

export function sortGroupNames(
  methods: Record<string, readonly Method[]>,
): string[] {
  return Object.keys(methods).sort((a, b) =>
    compareGroups(methods[a], a, methods[b], b),
  );
}

/**
 * Primarily sorts methods into the following order:
 * - Unsaved positive AutoModel predictions
 * - Negative AutoModel predictions
 * - Unsaved manual models + unmodeled methods
 * - Saved models from this model pack (AutoModel and manual)
 * - Methods not modelable in this model pack
 *
 * Secondary sort order is by number of usages descending, then by method signature ascending.
 */
export function sortMethods(
  methods: readonly Method[],
  modeledMethodsMap: Record<string, readonly ModeledMethod[]>,
  modifiedSignatures: ReadonlySet<string>,
): Method[] {
  const sortedMethods = [...methods];
  sortedMethods.sort((a, b) => {
    // First sort by the type of method
    const methodAPrimarySortOrdinal = getMethodPrimarySortOrdinal(
      a,
      modeledMethodsMap[a.signature] ?? [],
      modifiedSignatures.has(a.signature),
    );
    const methodBPrimarySortOrdinal = getMethodPrimarySortOrdinal(
      b,
      modeledMethodsMap[b.signature] ?? [],
      modifiedSignatures.has(b.signature),
    );
    if (methodAPrimarySortOrdinal !== methodBPrimarySortOrdinal) {
      return methodAPrimarySortOrdinal - methodBPrimarySortOrdinal;
    }

    // Then sort by number of usages descending
    const usageDifference = b.usages.length - a.usages.length;
    if (usageDifference !== 0) {
      return usageDifference;
    }

    // Then sort by method signature ascending
    return a.signature.localeCompare(b.signature);
  });
  return sortedMethods;
}

/**
 * Assigns numbers to the following classes of methods:
 * - Unsaved manual models + unmodeled methods => 0
 * - Saved models from this model pack (AutoModel and manual) => 1
 * - Methods not modelable in this model pack => 2
 */
function getMethodPrimarySortOrdinal(
  method: Method,
  modeledMethods: readonly ModeledMethod[],
  isUnsaved: boolean,
): number {
  const canBeModeled = canMethodBeModeled(method, modeledMethods, isUnsaved);
  const isModeled = modeledMethods.length > 0;
  if (canBeModeled) {
    if ((isModeled && isUnsaved) || !isModeled) {
      return 0;
    } else {
      return 1;
    }
  } else {
    return 2;
  }
}

function compareGroups(
  a: readonly Method[],
  aName: string,
  b: readonly Method[],
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
