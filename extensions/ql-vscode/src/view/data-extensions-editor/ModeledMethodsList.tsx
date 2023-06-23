import * as React from "react";
import { useMemo } from "react";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { calculateModeledPercentage } from "./modeled";
import { LibraryRow } from "./LibraryRow";
import { Mode } from "../../data-extensions-editor/shared/mode";

type Props = {
  externalApiUsages: ExternalApiUsage[];
  modeledMethods: Record<string, ModeledMethod>;
  mode: Mode;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const ModeledMethodsList = ({
  externalApiUsages,
  modeledMethods,
  mode,
  onChange,
}: Props) => {
  const grouped = useMemo(() => {
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
  }, [externalApiUsages, mode]);

  const sortedGroupNames = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const supportedPercentageA = calculateModeledPercentage(grouped[a]);
      const supportedPercentageB = calculateModeledPercentage(grouped[b]);

      // Sort first by supported percentage ascending
      if (supportedPercentageA > supportedPercentageB) {
        return 1;
      }
      if (supportedPercentageA < supportedPercentageB) {
        return -1;
      }

      const numberOfUsagesA = grouped[a].reduce(
        (acc, curr) => acc + curr.usages.length,
        0,
      );
      const numberOfUsagesB = grouped[b].reduce(
        (acc, curr) => acc + curr.usages.length,
        0,
      );

      // If the number of usages is equal, sort by number of methods descending
      if (numberOfUsagesA === numberOfUsagesB) {
        const numberOfMethodsA = grouped[a].length;
        const numberOfMethodsB = grouped[b].length;

        // If the number of methods is equal, sort by library name ascending
        if (numberOfMethodsA === numberOfMethodsB) {
          return a.localeCompare(b);
        }

        return numberOfMethodsB - numberOfMethodsA;
      }

      // Then sort by number of usages descending
      return numberOfUsagesB - numberOfUsagesA;
    });
  }, [grouped]);

  return (
    <>
      {sortedGroupNames.map((libraryName) => (
        <LibraryRow
          key={libraryName}
          title={libraryName}
          externalApiUsages={grouped[libraryName]}
          modeledMethods={modeledMethods}
          mode={mode}
          onChange={onChange}
        />
      ))}
    </>
  );
};
