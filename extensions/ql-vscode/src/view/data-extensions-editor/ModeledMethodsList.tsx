import * as React from "react";
import { useMemo } from "react";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { LibraryRow } from "./LibraryRow";
import { Mode } from "../../data-extensions-editor/shared/mode";
import {
  groupMethods,
  sortGroupNames,
} from "../../data-extensions-editor/shared/sorting";
import { DataExtensionEditorViewState } from "../../data-extensions-editor/shared/view-state";

type Props = {
  externalApiUsages: ExternalApiUsage[];
  unsavedModels: Set<string>;
  modeledMethods: Record<string, ModeledMethod>;
  viewState: DataExtensionEditorViewState;
  onChange: (
    modelName: string,
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
  onSaveModelClick: (
    modelName: string,
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ) => void;
  onGenerateFromLlmClick: (
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ) => void;
  onGenerateFromSourceClick: () => void;
};

const libraryNameOverrides: Record<string, string> = {
  rt: "Java Runtime",
};

export const ModeledMethodsList = ({
  externalApiUsages,
  unsavedModels,
  modeledMethods,
  viewState,
  onChange,
  onSaveModelClick,
  onGenerateFromLlmClick,
  onGenerateFromSourceClick,
}: Props) => {
  const grouped = useMemo(
    () => groupMethods(externalApiUsages, viewState.mode),
    [externalApiUsages, viewState.mode],
  );

  const libraryVersions = useMemo(() => {
    if (viewState.mode !== Mode.Application) {
      return {};
    }

    const libraryVersions: Record<string, string> = {};

    for (const externalApiUsage of externalApiUsages) {
      const { library, libraryVersion } = externalApiUsage;

      if (library && libraryVersion) {
        libraryVersions[library] = libraryVersion;
      }
    }

    return libraryVersions;
  }, [externalApiUsages, viewState.mode]);

  const sortedGroupNames = useMemo(() => sortGroupNames(grouped), [grouped]);

  return (
    <>
      {sortedGroupNames.map((libraryName) => (
        <LibraryRow
          key={libraryName}
          title={libraryNameOverrides[libraryName] ?? libraryName}
          libraryVersion={libraryVersions[libraryName]}
          externalApiUsages={grouped[libraryName]}
          hasUnsavedChanges={unsavedModels.has(libraryName)}
          modeledMethods={modeledMethods}
          viewState={viewState}
          onChange={onChange}
          onSaveModelClick={onSaveModelClick}
          onGenerateFromLlmClick={onGenerateFromLlmClick}
          onGenerateFromSourceClick={onGenerateFromSourceClick}
        />
      ))}
    </>
  );
};
