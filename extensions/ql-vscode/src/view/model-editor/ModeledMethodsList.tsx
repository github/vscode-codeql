import { useMemo } from "react";
import type { Method } from "../../model-editor/method";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { LibraryRow } from "./LibraryRow";
import { Mode } from "../../model-editor/shared/mode";
import {
  groupMethods,
  sortGroupNames,
} from "../../model-editor/shared/sorting";
import type { ModelEditorViewState } from "../../model-editor/shared/view-state";
import type { AccessPathSuggestionOptions } from "../../model-editor/suggestions";
import type { ModelEvaluationRunState } from "../../model-editor/shared/model-evaluation-run-state";

export type ModeledMethodsListProps = {
  methods: Method[];
  modeledMethodsMap: Record<string, ModeledMethod[]>;
  modifiedSignatures: Set<string>;
  selectedSignatures: Set<string>;
  revealedMethodSignature: string | null;
  accessPathSuggestions?: AccessPathSuggestionOptions;
  evaluationRun: ModelEvaluationRunState | undefined;
  viewState: ModelEditorViewState;
  hideModeledMethods: boolean;
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
  onMethodClick: (methodSignature: string) => void;
  onSaveModelClick: (methodSignatures: string[]) => void;
  onGenerateFromSourceClick: () => void;
  onModelDependencyClick: () => void;
};

const libraryNameOverrides: Record<string, string> = {
  rt: "Java Runtime",
};

export const ModeledMethodsList = ({
  methods,
  modeledMethodsMap,
  modifiedSignatures,
  selectedSignatures,
  viewState,
  hideModeledMethods,
  revealedMethodSignature,
  accessPathSuggestions,
  evaluationRun,
  onChange,
  onMethodClick,
  onSaveModelClick,
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
          modeledMethodsMap={modeledMethodsMap}
          modifiedSignatures={modifiedSignatures}
          selectedSignatures={selectedSignatures}
          viewState={viewState}
          hideModeledMethods={hideModeledMethods}
          revealedMethodSignature={revealedMethodSignature}
          accessPathSuggestions={accessPathSuggestions}
          evaluationRun={evaluationRun}
          onChange={onChange}
          onMethodClick={onMethodClick}
          onSaveModelClick={onSaveModelClick}
          onGenerateFromSourceClick={onGenerateFromSourceClick}
          onModelDependencyClick={onModelDependencyClick}
        />
      ))}
    </>
  );
};
