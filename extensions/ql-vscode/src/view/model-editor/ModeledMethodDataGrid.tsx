import { MethodRow } from "./MethodRow";
import type { Method } from "../../model-editor/method";
import { canMethodBeModeled } from "../../model-editor/method";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { useMemo } from "react";
import { HiddenMethodsRow } from "./HiddenMethodsRow";
import type { ModelEditorViewState } from "../../model-editor/shared/view-state";
import { ScreenReaderOnly } from "../common/ScreenReaderOnly";
import { DataGrid, DataGridCell } from "../common/DataGrid";
import type { AccessPathSuggestionOptions } from "../../model-editor/suggestions";
import type { ModelEvaluationRunState } from "../../model-editor/shared/model-evaluation-run-state";

export const MULTIPLE_MODELS_GRID_TEMPLATE_COLUMNS =
  "0.5fr 0.125fr 0.125fr 0.125fr 0.125fr max-content";

export type ModeledMethodDataGridProps = {
  methods: Method[];
  modeledMethodsMap: Record<string, ModeledMethod[]>;
  modifiedSignatures: Set<string>;
  selectedSignatures: Set<string>;
  viewState: ModelEditorViewState;
  hideModeledMethods: boolean;
  revealedMethodSignature: string | null;
  accessPathSuggestions?: AccessPathSuggestionOptions;
  evaluationRun: ModelEvaluationRunState | undefined;
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
  onMethodClick: (methodSignature: string) => void;
};

export const ModeledMethodDataGrid = ({
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
}: ModeledMethodDataGridProps) => {
  const [methodsWithModelability, numHiddenMethods]: [
    Array<{ method: Method; methodCanBeModeled: boolean }>,
    number,
  ] = useMemo(() => {
    const methodsWithModelability = [];
    let numHiddenMethods = 0;
    for (const method of methods) {
      const modeledMethods = modeledMethodsMap[method.signature] ?? [];
      const methodIsUnsaved = modifiedSignatures.has(method.signature);
      const methodCanBeModeled = canMethodBeModeled(
        method,
        modeledMethods,
        methodIsUnsaved,
      );

      if (methodCanBeModeled || !hideModeledMethods) {
        methodsWithModelability.push({ method, methodCanBeModeled });
      } else {
        numHiddenMethods += 1;
      }
    }
    return [methodsWithModelability, numHiddenMethods];
  }, [hideModeledMethods, methods, modeledMethodsMap, modifiedSignatures]);

  const someMethodsAreVisible = methodsWithModelability.length > 0;

  return (
    <DataGrid gridTemplateColumns={MULTIPLE_MODELS_GRID_TEMPLATE_COLUMNS}>
      {someMethodsAreVisible && (
        <>
          <DataGridCell rowType="header">API or method</DataGridCell>
          <DataGridCell rowType="header">Model type</DataGridCell>
          <DataGridCell rowType="header">Input</DataGridCell>
          <DataGridCell rowType="header">Output</DataGridCell>
          <DataGridCell rowType="header">Kind</DataGridCell>
          <DataGridCell rowType="header">
            <ScreenReaderOnly>Add or remove models</ScreenReaderOnly>
          </DataGridCell>
          {methodsWithModelability.map(({ method, methodCanBeModeled }) => {
            const modeledMethods = modeledMethodsMap[method.signature] ?? [];
            const inputAccessPathSuggestions =
              accessPathSuggestions?.input?.[method.signature];
            const outputAccessPathSuggestions =
              accessPathSuggestions?.output?.[method.signature];
            return (
              <MethodRow
                key={method.signature}
                method={method}
                methodCanBeModeled={methodCanBeModeled}
                modeledMethods={modeledMethods}
                methodIsUnsaved={modifiedSignatures.has(method.signature)}
                methodIsSelected={selectedSignatures.has(method.signature)}
                viewState={viewState}
                revealedMethodSignature={revealedMethodSignature}
                inputAccessPathSuggestions={inputAccessPathSuggestions}
                outputAccessPathSuggestions={outputAccessPathSuggestions}
                evaluationRun={evaluationRun}
                onChange={onChange}
                onMethodClick={onMethodClick}
              />
            );
          })}
        </>
      )}
      <HiddenMethodsRow
        numHiddenMethods={numHiddenMethods}
        someMethodsAreVisible={someMethodsAreVisible}
      />
    </DataGrid>
  );
};
