import * as React from "react";
import { useMemo } from "react";
import { Method } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { LibraryRow } from "./LibraryRow";
import { Mode } from "../../model-editor/shared/mode";
import {
  groupMethods,
  sortGroupNames,
} from "../../model-editor/shared/sorting";
import { ModelEditorViewState } from "../../model-editor/shared/view-state";
import { InProgressMethods } from "../../model-editor/shared/in-progress-methods";

export type ModeledMethodsListProps = {
  methods: Method[];
  modeledMethods: Record<string, ModeledMethod>;
  modifiedSignatures: Set<string>;
  inProgressMethods: InProgressMethods;
  viewState: ModelEditorViewState;
  hideModeledMethods: boolean;
  onChange: (
    modelName: string,
    method: Method,
    modeledMethod: ModeledMethod,
  ) => void;
  onSaveModelClick: (
    methods: Method[],
    modeledMethods: Record<string, ModeledMethod>,
  ) => void;
  onGenerateFromLlmClick: (
    packageName: string,
    methods: Method[],
    modeledMethods: Record<string, ModeledMethod>,
  ) => void;
  onStopGenerateFromLlmClick: (packageName: string) => void;
  onGenerateFromSourceClick: () => void;
  onModelDependencyClick: () => void;
};

const libraryNameOverrides: Record<string, string> = {
  rt: "Java Runtime",
};

export const ModeledMethodsList = ({
  methods,
  modeledMethods,
  modifiedSignatures,
  inProgressMethods,
  viewState,
  hideModeledMethods,
  onChange,
  onSaveModelClick,
  onGenerateFromLlmClick,
  onStopGenerateFromLlmClick,
  onGenerateFromSourceClick,
  onModelDependencyClick,
}: ModeledMethodsListProps) => {
  const grouped = useMemo(
    () => groupMethods(methods, viewState.mode),
    [methods, viewState.mode],
  );

  const libraryVersions = useMemo(() => {
    if (viewState.mode !== Mode.Application) {
      return {};
    }

    const libraryVersions: Record<string, string> = {};

    for (const method of methods) {
      const { library, libraryVersion } = method;

      if (library && libraryVersion) {
        libraryVersions[library] = libraryVersion;
      }
    }

    return libraryVersions;
  }, [methods, viewState.mode]);

  const sortedGroupNames = useMemo(() => sortGroupNames(grouped), [grouped]);

  return (
    <>
      {sortedGroupNames.map((libraryName) => (
        <LibraryRow
          key={libraryName}
          title={libraryNameOverrides[libraryName] ?? libraryName}
          libraryVersion={libraryVersions[libraryName]}
          methods={grouped[libraryName]}
          modeledMethods={modeledMethods}
          modifiedSignatures={modifiedSignatures}
          inProgressMethods={inProgressMethods}
          viewState={viewState}
          hideModeledMethods={hideModeledMethods}
          onChange={onChange}
          onSaveModelClick={onSaveModelClick}
          onGenerateFromLlmClick={onGenerateFromLlmClick}
          onStopGenerateFromLlmClick={onStopGenerateFromLlmClick}
          onGenerateFromSourceClick={onGenerateFromSourceClick}
          onModelDependencyClick={onModelDependencyClick}
        />
      ))}
    </>
  );
};
