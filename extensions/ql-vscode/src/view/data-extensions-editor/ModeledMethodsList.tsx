import * as React from "react";
import { useMemo } from "react";
import styled from "styled-components";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { ModeledMethodDataGrid } from "./ModeledMethodDataGrid";
import { calculateModeledPercentage } from "./modeled";

const LibraryContainer = styled.div`
  margin-bottom: 1rem;
`;

type Props = {
  externalApiUsages: ExternalApiUsage[];
  modeledMethods: Record<string, ModeledMethod>;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const ModeledMethodsList = ({
  externalApiUsages,
  modeledMethods,
  onChange,
}: Props) => {
  const groupedByLibrary = useMemo(() => {
    const groupedByLibrary: Record<string, ExternalApiUsage[]> = {};

    for (const externalApiUsage of externalApiUsages) {
      groupedByLibrary[externalApiUsage.library] ??= [];
      groupedByLibrary[externalApiUsage.library].push(externalApiUsage);
    }

    return groupedByLibrary;
  }, [externalApiUsages]);

  const sortedLibraryNames = useMemo(() => {
    return Object.keys(groupedByLibrary).sort((a, b) => {
      const supportedPercentageA = calculateModeledPercentage(
        groupedByLibrary[a],
      );
      const supportedPercentageB = calculateModeledPercentage(
        groupedByLibrary[b],
      );

      // Sort first by supported percentage ascending
      if (supportedPercentageA > supportedPercentageB) {
        return 1;
      }
      if (supportedPercentageA < supportedPercentageB) {
        return -1;
      }

      const numberOfUsagesA = groupedByLibrary[a].reduce(
        (acc, curr) => acc + curr.usages.length,
        0,
      );
      const numberOfUsagesB = groupedByLibrary[b].reduce(
        (acc, curr) => acc + curr.usages.length,
        0,
      );

      // Then sort by number of usages descending
      return numberOfUsagesB - numberOfUsagesA;
    });
  }, [groupedByLibrary]);

  return (
    <>
      {sortedLibraryNames.map((libraryName) => (
        <LibraryContainer key={libraryName}>
          <h3>{libraryName}</h3>
          <ModeledMethodDataGrid
            externalApiUsages={groupedByLibrary[libraryName]}
            modeledMethods={modeledMethods}
            onChange={onChange}
          />
        </LibraryContainer>
      ))}
    </>
  );
};
